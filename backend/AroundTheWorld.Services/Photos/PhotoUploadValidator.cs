using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services.Photos;

public class PhotoUploadValidator(IOptions<PhotoStorageOptions> options) : IPhotoUploadValidator
{
    public void Validate(long lengthInBytes, string? contentType)
    {
        var settings = options.Value;

        if (lengthInBytes <= 0)
        {
            throw new ValidationException("That photo came through empty — try again.");
        }

        if (lengthInBytes > settings.MaxBytes)
        {
            var limit = settings.MaxBytes / (1024 * 1024);
            throw new ValidationException($"That photo is too big — keep it under {limit}MB.");
        }

        // Compare on the media type alone: browsers append parameters such as
        // "; charset=..." and a mobile camera capture may include a codec hint.
        var mediaType = (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();

        if (!settings.AllowedContentTypes.Contains(mediaType))
        {
            throw new ValidationException("That file isn't an image we can use — JPEG, PNG, WebP or HEIC.");
        }
    }
}
