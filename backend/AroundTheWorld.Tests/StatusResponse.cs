namespace AroundTheWorld.Tests;

/// <summary>Test-side mirror of the JSON shape returned by GET /api/status.</summary>
public sealed record StatusResponse(string Version, string FriendlyStatus, DateTime Timestamp);
