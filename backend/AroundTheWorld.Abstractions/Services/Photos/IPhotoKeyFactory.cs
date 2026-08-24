namespace AroundTheWorld.Abstractions.Services.Photos;

public interface IPhotoKeyFactory
{
    string Create(string contentType);
}
