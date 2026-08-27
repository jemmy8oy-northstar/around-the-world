using Amazon.Runtime;
using Amazon.S3;
using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Services.Photos;

namespace AroundTheWorld.WebApi.Photos;

public static class PhotoStorageRegistration
{
    /// <summary>
    /// Picks the photo backend from configuration, mirroring how the connection
    /// string already gates the database: fully configured OCI credentials get
    /// Object Storage, anything less falls back to disk so the app still runs.
    /// </summary>
    public static void AddPhotoStorage(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(PhotoStorageOptions.SectionName).Get<PhotoStorageOptions>()
            ?? new PhotoStorageOptions();

        services.AddSingleton<IPhotoKeyFactory, PhotoKeyFactory>();
        services.AddScoped<IPhotoUploadValidator, PhotoUploadValidator>();

        if (!options.IsObjectStorageConfigured)
        {
            Console.WriteLine(
                "[WARNING] No OCI Object Storage credentials configured — photos will be written to " +
                $"'{options.LocalRootPath}' on local disk. Fine for development; not for multiple replicas.");

            services.AddScoped<IPhotoStorage, FileSystemPhotoStorage>();
            return;
        }

        services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
            new AmazonS3Config
            {
                ServiceURL = options.ServiceUrl,
                AuthenticationRegion = options.Region,

                // OCI's S3 compatibility layer does not support virtual-host style
                // bucket addressing, so requests must be path-style.
                ForcePathStyle = true,

                // AWS SDK v4 computes a CRC32 checksum on every upload by default
                // and sends it as x-amz-sdk-checksum-algorithm. OCI's S3 layer does
                // not implement that header and answers 501 NotImplemented — which
                // is what every photo upload got on 27 Aug, while GetObject (no
                // checksum header, no body) worked with the same key pair and made
                // it look like a permissions problem. WHEN_REQUIRED sends a checksum
                // only for the operations that genuinely mandate one.
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            }));

        services.AddScoped<IPhotoStorage, ObjectStoragePhotoStorage>();
    }
}
