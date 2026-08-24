using Amazon.S3;
using Amazon.S3.Model;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Services.Photos;
using Microsoft.Extensions.Options;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace AroundTheWorld.Tests.Photos;

public class ObjectStoragePhotoStorageTests
{
    private readonly IAmazonS3 s3Client = Substitute.For<IAmazonS3>();

    private ObjectStoragePhotoStorage Storage(PhotoStorageOptions options) =>
        new(s3Client, Options.Create(options), new PhotoKeyFactory());

    private static PhotoStorageOptions Configured(string publicBaseUrl = "") => new()
    {
        AccessKeyId = "key",
        SecretAccessKey = "secret",
        Bucket = "drinks",
        ServiceUrl = "https://ns.compat.objectstorage.uk-london-1.oraclecloud.com",
        PublicBaseUrl = publicBaseUrl,
    };

    [Fact]
    public async Task SaveAsync_puts_the_object_in_the_configured_bucket()
    {
        var key = await Storage(Configured()).SaveAsync(new MemoryStream([1, 2, 3]), "image/png");

        await s3Client.Received(1).PutObjectAsync(
            Arg.Is<PutObjectRequest>(r => r.BucketName == "drinks" && r.Key == key && r.ContentType == "image/png"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SaveAsync_surfaces_a_storage_outage_as_an_upstream_failure()
    {
        s3Client.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Throws(new AmazonS3Exception("bucket is gone"));

        // Not a 500: the person holding the phone should be told to try again.
        await Assert.ThrowsAsync<UpstreamServiceException>(
            () => Storage(Configured()).SaveAsync(new MemoryStream([1]), "image/jpeg"));
    }

    [Fact]
    public void ResolveUrl_points_at_the_public_bucket_when_one_is_configured()
    {
        var url = Storage(Configured("https://cdn.example.com/drinks/")).ResolveUrl("abc.jpg");

        // Trailing slash on the base must not produce a double slash.
        Assert.Equal("https://cdn.example.com/drinks/abc.jpg", url);
    }

    [Fact]
    public void ResolveUrl_proxies_through_this_api_when_the_bucket_is_not_public()
    {
        Assert.Equal("/api/photos/abc.jpg", Storage(Configured()).ResolveUrl("abc.jpg"));
    }

    [Fact]
    public void IsObjectStorageConfigured_is_false_until_every_setting_is_present()
    {
        Assert.False(new PhotoStorageOptions().IsObjectStorageConfigured);
        Assert.False(new PhotoStorageOptions { AccessKeyId = "key", Bucket = "b" }.IsObjectStorageConfigured);
        Assert.True(Configured().IsObjectStorageConfigured);
    }
}
