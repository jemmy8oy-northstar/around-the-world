using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AroundTheWorld.Database.Migrations
{
    /// <inheritdoc />
    public partial class AddReleasedAtToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_UsernameNormalised",
                table: "Users");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReleasedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_UsernameNormalised",
                table: "Users",
                column: "UsernameNormalised",
                unique: true,
                filter: "\"ReleasedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_UsernameNormalised",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReleasedAt",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_Users_UsernameNormalised",
                table: "Users",
                column: "UsernameNormalised",
                unique: true);
        }
    }
}
