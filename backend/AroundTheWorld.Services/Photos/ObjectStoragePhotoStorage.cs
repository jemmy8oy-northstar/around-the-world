using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services.Photos;

/// <summary>
/// OCI Object Storage through its S3-compatible API. Credentials come from an S3
/// Compatibility API key created in OCI IAM — see the README for the bucket setup.
/// </summary>
public class ObjectStoragePhotoStorage(
    IAmazonS3 s3Client,
    IOptions<PhotoStorageOptions> options,
    IPhotoKeyFactory photoKeyFactory) : IPhotoStorage
{
    public async Task<string> SaveAsync(
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        var key = photoKeyFactory.Create(contentType);

        try
        {
            await s3Client.PutObjectAsync(
                new PutObjectRequest
                {
                    BucketName = settings.Bucket,
                    Key = key,
                    InputStream = content,
                    ContentType = contentType,
                    DisablePayloadSigning = true,
                },
                cancellationToken);
        }
        catch (AmazonServiceException exception)
        {
            // A failed upload is an upstream failure, not a 500 — the person
            // holding the phone should be told to try again, not shown a crash.
            throw new UpstreamServiceException(
                $"Couldn't save that photo — try again. [storage: {Describe(exception)}]", exception);
        }

        return key;
    }

    /// <summary>
    /// The smallest thing that says which layer refused the upload, carrying no
    /// credential material: the S3 error code and HTTP status. The code is one of
    /// a handful of fixed strings and each names a different fix —
    /// <c>InvalidAccessKeyId</c> and <c>SignatureDoesNotMatch</c> mean the key
    /// pair, <c>NoSuchBucket</c> the bucket name or region, <c>AccessDenied</c>
    /// the IAM policy. Without it one sentence covers all four and the only way
    /// to tell them apart is another deploy — which is what it cost on the night
    /// before the party (#18). Falls back to the exception type when the SDK
    /// never reached OCI at all, so a DNS or TLS failure still reads differently.
    /// </summary>
    private static string Describe(AmazonServiceException exception)
    {
        var code = string.IsNullOrWhiteSpace(exception.ErrorCode)
            ? exception.GetType().Name
            : exception.ErrorCode;

        return exception.StatusCode == 0 ? code : $"{code}/{(int)exception.StatusCode}";
    }

    /// <summary>
    /// Points straight at the bucket when it is public-read, which keeps photo
    /// bandwidth off the cluster entirely. Falls back to proxying through this API
    /// when no public base URL is configured, so a private bucket still works.
    /// </summary>
    public string ResolveUrl(string photoKey)
    {
        var publicBaseUrl = options.Value.PublicBaseUrl;

        return string.IsNullOrWhiteSpace(publicBaseUrl)
            ? $"/api/photos/{photoKey}"
            : $"{publicBaseUrl.TrimEnd('/')}/{photoKey}";
    }

    public async Task<Stream?> OpenAsync(string photoKey, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await s3Client.GetObjectAsync(
                options.Value.Bucket, photoKey, cancellationToken);

            return response.ResponseStream;
        }
        catch (AmazonS3Exception exception)
            when (exception.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
