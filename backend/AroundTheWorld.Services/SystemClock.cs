using AroundTheWorld.Abstractions.Services;

namespace AroundTheWorld.Services;

public class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
