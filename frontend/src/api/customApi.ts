import { emptySplitApi } from "./emptyApi";
import type { Post } from "./generatedApi";

/**
 * Endpoints the OpenAPI codegen cannot express usefully.
 *
 * `POST /api/posts` is multipart. The generated client hands its `body` object
 * straight to fetchBaseQuery, which JSON-serialises it — so the photo would
 * arrive as `{}`. This builds the FormData by hand instead. Kept out of
 * generatedApi.ts because that file is overwritten by `npm run codegen`.
 */
export const customApi = emptySplitApi.injectEndpoints({
  endpoints: (build) => ({
    createDrinkPost: build.mutation<
      Post,
      { photo: Blob; caption: string; countryCode: string }
    >({
      query: ({ photo, caption, countryCode }) => {
        const form = new FormData();

        // The filename matters: without one, the browser sends the part with no
        // filename and ASP.NET Core does not bind it as an IFormFile.
        form.append("photo", photo, "drink.jpg");
        form.append("caption", caption);
        form.append("countryCode", countryCode);

        return { url: "/api/posts", method: "POST", body: form };
      },
      invalidatesTags: ["Posts", "Countries"],
    }),
  }),
});

export const { useCreateDrinkPostMutation } = customApi;
