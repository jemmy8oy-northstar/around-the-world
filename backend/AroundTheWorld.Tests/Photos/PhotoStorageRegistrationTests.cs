using Amazon.Runtime;
using Amazon.S3;
using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Services.Photos;
using AroundTheWorld.WebApi.Photos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AroundTheWorld.Tests.Photos;

/// <summary>
/// Pins the S3 client settings OCI's compatibility layer requires. Every one of
/// these is a silent SDK default that reads as harmless and breaks uploads in
/// production only — which is exactly how photo upload failed on 27 Aug, with
/// the app healthy, the credentials valid and every other instrument green.
/// </summary>
public class PhotoStorageRegistrationTests
{
    private static IServiceProvider Configured(params (string Key, string Value)[] overrides)
    {
        var settings = new Dictionary<string, string?>
        {
            ["PhotoStorage:AccessKeyId"] = "key",
            ["PhotoStorage:SecretAccessKey"] = "secret",
            ["PhotoStorage:Bucket"] = "drinks",
            ["PhotoStorage:ServiceUrl"] = "https://ns.compat.objectstorage.uk-london-1.oraclecloud.com",
            ["PhotoStorage:Region"] = "uk-london-1",
        };

        foreach (var (key, value) in overrides)
        {
            settings[key] = value;
        }

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

        var services = new ServiceCollection();
        services.AddPhotoStorage(configuration);
        services.Configure<Services.Configuration.PhotoStorageOptions>(
            configuration.GetSection("PhotoStorage"));

        return services.BuildServiceProvider();
    }

    [Fact]
    public void The_s3_client_does_not_send_checksums_oci_cannot_answer()
    {
        var config = Configured().GetRequiredService<IAmazonS3>().Config;

        // AWS SDK v4 defaults to WHEN_SUPPORTED, which puts a CRC32 checksum on
        // every PutObject. OCI answers 501 NotImplemented — the exact failure
        // James saw as "[storage: NotImplemented/501]" (#18).
        Assert.Equal(RequestChecksumCalculation.WHEN_REQUIRED, config.RequestChecksumCalculation);
        Assert.Equal(ResponseChecksumValidation.WHEN_REQUIRED, config.ResponseChecksumValidation);
    }

    [Fact]
    public void The_s3_client_addresses_buckets_path_style()
    {
        // OCI's S3 layer has no virtual-host style addressing at all.
        var config = Assert.IsType<AmazonS3Config>(
            Configured().GetRequiredService<IAmazonS3>().Config);

        Assert.True(config.ForcePathStyle);
    }

    [Fact]
    public void Object_storage_is_used_when_every_setting_is_present()
    {
        Assert.IsType<ObjectStoragePhotoStorage>(
            Configured().GetRequiredService<IPhotoStorage>());
    }

    [Fact]
    public void A_missing_setting_falls_back_to_disk_rather_than_failing_to_start()
    {
        // The fallback is deliberate, but it is also why an empty value is not a
        // safe default: photos would be written to the pod and vanish on restart.
        Assert.IsType<FileSystemPhotoStorage>(
            Configured(("PhotoStorage:SecretAccessKey", "")).GetRequiredService<IPhotoStorage>());
    }
}
