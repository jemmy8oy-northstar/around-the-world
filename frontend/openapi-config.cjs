/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
const config = {
  // Read the OpenAPI contract the backend emits at build time (see
  // backend/AroundTheWorld.WebApi.csproj → OpenApiGenerateDocumentsOnBuild). Using the committed
  // file rather than a live http://localhost:5257 endpoint means `npm run codegen` works
  // offline and in CI without a running backend. Regenerate the file with a Debug backend
  // build after changing the API.
  schemaFile: '../backend/AroundTheWorld.WebApi/openapi.json',
  apiFile: './src/api/emptyApi.ts',
  apiImport: 'emptySplitApi',
  outputFile: './src/api/generatedApi.ts',
  hooks: true,
};

module.exports = config;
