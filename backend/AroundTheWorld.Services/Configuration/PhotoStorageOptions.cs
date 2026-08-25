namespace AroundTheWorld.Services.Configuration;

/// <summary>
/// OCI Object Storage settings, bound from the <c>PhotoStorage</c> section. When
/// <see cref="AccessKeyId"/>, <see cref="SecretAccessKey"/>, <see cref="Bucket"/>
/// and <see cref="ServiceUrl"/> are not all present the app falls back to
/// on-disk storage, so a developer with no OCI account can still run everything.
/// </summary>
public class PhotoStorageOptions
{
    public const string SectionName = "PhotoStorage";

    /// <summary>S3 Compatibility API key from OCI IAM.</summary>
    public string AccessKeyId { get; set; } = string.Empty;

    public string SecretAccessKey { get; set; } = string.Empty;

    public string Bucket { get; set; } = string.Empty;

    /// <summary>e.g. https://{namespace}.compat.objectstorage.uk-london-1.oraclecloud.com</summary>
    public string ServiceUrl { get; set; } = string.Empty;

    public string Region { get; set; } = "uk-london-1";

    /// <summary>
    /// Public base URL of the bucket. Leave empty to serve photos through this
    /// API instead — which is what happens if the bucket is not public-read.
    /// </summary>
    public string PublicBaseUrl { get; set; } = string.Empty;

    /// <summary>Where the on-disk fallback writes to.</summary>
    public string LocalRootPath { get; set; } = "photo-store";

    /// <summary>
    /// 8MB. The client compresses to a few hundred KB before uploading, so this
    /// is a backstop against a client that doesn't, not the expected size.
    /// </summary>
    public long MaxBytes { get; set; } = 8 * 1024 * 1024;

    public string[] AllowedContentTypes { get; set; } =
        ["image/jpeg", "image/png", "image/webp", "image/heic"];

    /// <summary>True when every setting the S3 client needs is present.</summary>
    public bool IsObjectStorageConfigured =>
        !string.IsNullOrWhiteSpace(AccessKeyId)
        && !string.IsNullOrWhiteSpace(SecretAccessKey)
        && !string.IsNullOrWhiteSpace(Bucket)
        && !string.IsNullOrWhiteSpace(ServiceUrl);
}
