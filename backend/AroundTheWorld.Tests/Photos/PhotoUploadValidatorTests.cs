using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Services.Photos;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Tests.Photos;

public class PhotoUploadValidatorTests
{
    private readonly PhotoUploadValidator validator =
        new(Options.Create(new PhotoStorageOptions { MaxBytes = 1024 }));

    [Fact]
    public void Validate_accepts_a_normal_jpeg()
    {
        validator.Validate(500, "image/jpeg");
    }

    [Theory]
    [InlineData("image/jpeg; charset=binary")]
    [InlineData("IMAGE/JPEG")]
    [InlineData(" image/png ")]
    public void Validate_ignores_content_type_parameters_and_casing(string contentType)
    {
        // A mobile camera capture routinely appends parameters; rejecting those
        // would fail real uploads from real phones.
        validator.Validate(500, contentType);
    }

    [Fact]
    public void Validate_rejects_an_empty_upload()
    {
        Assert.Throws<ValidationException>(() => validator.Validate(0, "image/jpeg"));
    }

    [Fact]
    public void Validate_rejects_an_oversized_upload()
    {
        Assert.Throws<ValidationException>(() => validator.Validate(1025, "image/jpeg"));
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("text/html")]
    [InlineData("image/svg+xml")]
    [InlineData(null)]
    [InlineData("")]
    public void Validate_rejects_anything_that_is_not_an_allowed_image(string? contentType)
    {
        // image/svg+xml is on this list deliberately: an SVG is a script-execution
        // vector, not a photo.
        Assert.Throws<ValidationException>(() => validator.Validate(500, contentType));
    }
}
