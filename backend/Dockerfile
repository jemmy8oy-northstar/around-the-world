# Stage 1: Build .NET app
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /source

# Copy solution and project files
COPY AroundTheWorld.slnx .
COPY AroundTheWorld.WebApi/*.csproj ./AroundTheWorld.WebApi/
COPY AroundTheWorld.Abstractions/*.csproj ./AroundTheWorld.Abstractions/
COPY AroundTheWorld.DataModels/*.csproj ./AroundTheWorld.DataModels/
COPY AroundTheWorld.DomainModels/*.csproj ./AroundTheWorld.DomainModels/
COPY AroundTheWorld.Services/*.csproj ./AroundTheWorld.Services/
COPY AroundTheWorld.EntityModels/*.csproj ./AroundTheWorld.EntityModels/ 
COPY AroundTheWorld.Database/*.csproj ./AroundTheWorld.Database/
COPY AroundTheWorld.Tests/*.csproj ./AroundTheWorld.Tests/
COPY AroundTheWorld.SourceGenerators/*.csproj ./AroundTheWorld.SourceGenerators/
# Restore dependencies
# NOTE: `dotnet restore` with no argument restores AroundTheWorld.slnx, so EVERY project
# listed there must have its .csproj copied above — including test projects, which are
# not published. Adding a project to the solution without a COPY line here breaks the
# image build only, and only on a push to main, long after CI has gone green.
RUN dotnet restore

# Copy all source files
COPY . .

# Build and publish
RUN dotnet publish AroundTheWorld.WebApi/AroundTheWorld.WebApi.csproj -c Release -o /app/publish

# Stage 2: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
COPY --from=build /app/publish .

# Expose port (default ASP.NET Core port is 8080 in .NET 8+)
EXPOSE 8080

ENTRYPOINT ["dotnet", "AroundTheWorld.WebApi.dll"]
