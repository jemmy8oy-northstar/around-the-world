using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace AroundTheWorld.Tests;

/// <summary>
/// End-to-end smoke test of the sample /api/status route against the real host: proves the
/// whole pipeline (routing, DI, serialization, exception handling) wires up and boots without
/// a database. This is the integration gate every downstream scaffold inherits.
/// </summary>
public class StatusApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Get_status_returns_ok_with_a_version()
    {
        using var factory = new StatusApiFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<StatusResponse>(Json);
        Assert.NotNull(payload);
        Assert.False(string.IsNullOrWhiteSpace(payload!.Version));
    }
}
