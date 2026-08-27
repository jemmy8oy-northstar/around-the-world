import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGetGameStateQuery } from "../api/atwApi";
import { useCreateDrinkPostMutation } from "../api/customApi";
import { CountryPicker } from "../components/CountryPicker";
import { EmptyState } from "../components/EmptyState";
import { compressImage } from "../photos/compressImage";
import { failureMessage } from "../api/problemDetail";
import "./Compose.css";

export default function Compose() {
  const navigate = useNavigate();
  const { data: game } = useGetGameStateQuery();
  const [createPost, { isLoading }] = useCreateDrinkPostMutation();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (game?.mode === "Finished") {
    return (
      <EmptyState
        icon="🌅"
        title="That's a wrap"
        message="The game is over — the feed is a keepsake now."
      />
    );
  }

  function onFileChosen(chosen: File | null) {
    setFile(chosen);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return chosen ? URL.createObjectURL(chosen) : null;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!file) return setError("Take a photo of the drink first.");
    if (!countryCode) return setError("Pick where the drink is from.");

    try {
      const compressed = await compressImage(file);

      await createPost({
        photo: compressed,
        caption,
        countryCode,
      }).unwrap();

      navigate("/");
    } catch (caught) {
      setError(failureMessage(caught, "That didn't send — try again."));
    }
  }

  return (
    <form className="compose" onSubmit={onSubmit}>
      <button
        type="button"
        className="compose__photo"
        onClick={() => fileInput.current?.click()}
      >
        {previewUrl ? (
          <img
            className="compose__preview"
            src={previewUrl}
            alt="The drink you're posting"
          />
        ) : (
          <span className="compose__photo-prompt">
            <span className="compose__photo-icon" aria-hidden="true">
              📸
            </span>
            Take a photo
          </span>
        )}
      </button>

      <input
        ref={fileInput}
        className="compose__file"
        type="file"
        accept="image/*"
        // Opens the camera directly on a phone rather than the photo library.
        capture="environment"
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
      />

      <label className="compose__label" htmlFor="caption">
        Caption
      </label>
      <input
        id="caption"
        className="compose__caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What is it?"
        maxLength={280}
      />

      <span className="compose__label">Where's it from?</span>
      <CountryPicker value={countryCode} onChange={setCountryCode} />

      {error && (
        <p className="compose__error" role="alert">
          {error}
        </p>
      )}

      <button className="compose__submit" type="submit" disabled={isLoading}>
        {isLoading ? "Posting…" : "Post it"}
      </button>
    </form>
  );
}
