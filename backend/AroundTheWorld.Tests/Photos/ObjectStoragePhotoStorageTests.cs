using System.Net;
using Amazon.Runtime;
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

    [Theory]
    [InlineData("InvalidAccessKeyId", HttpStatusCode.Forbidden, "InvalidAccessKeyId/403")]
    [InlineData("SignatureDoesNotMatch", HttpStatusCode.Forbidden, "SignatureDoesNotMatch/403")]
    [InlineData("NoSuchBucket", HttpStatusCode.NotFound, "NoSuchBucket/404")]
    public async Task SaveAsync_names_which_layer_refused_the_upload(
        string errorCode, HttpStatusCode status, string expected)
    {
        s3Client.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Throws(new AmazonS3Exception("denied") { ErrorCode = errorCode, StatusCode = status });

        var exception = await Assert.ThrowsAsync<UpstreamServiceException>(
            () => Storage(Configured()).SaveAsync(new MemoryStream([1]), "image/jpeg"));

        // Bad keys, a missing bucket and an IAM refusal are one sentence apart
        // otherwise, and telling them apart used to cost a whole deploy (#18).
        Assert.Contains(expected, exception.Message);

        // Still readable by a guest holding a phone at a party.
        Assert.StartsWith("Couldn't save that photo — try again.", exception.Message);
    }

    [Fact]
    public async Task SaveAsync_falls_back_to_the_exception_type_when_it_never_reached_oci()
    {
        // No ErrorCode and no status: DNS, TLS or a socket failure, which must
        // not read the same as a credential rejection.
        s3Client.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Throws(new AmazonS3Exception("connection refused"));

        var exception = await Assert.ThrowsAsync<UpstreamServiceException>(
            () => Storage(Configured()).SaveAsync(new MemoryStream([1]), "image/jpeg"));

        Assert.Contains("AmazonS3Exception", exception.Message);
    }

    [Fact]
    public async Task SaveAsync_also_catches_non_s3_sdk_failures()
    {
        // AmazonServiceException is the base the SDK throws for credential
        // resolution and endpoint errors; those used to escape as a bare 500
        // saying "an unexpected error occurred", which names nothing.
        s3Client.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Throws(new AmazonServiceException("no credentials"));

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
