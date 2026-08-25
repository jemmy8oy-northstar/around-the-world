namespace AroundTheWorld.Abstractions.Services.Photos;

public interface IPhotoUploadValidator
{
    /// <summary>
    /// Throws when the upload is not an image we accept, or is too large.
    /// The client compresses before uploading; this is the guard that does not
    /// trust it.
    /// </summary>
    void Validate(long lengthInBytes, string? contentType);
}
