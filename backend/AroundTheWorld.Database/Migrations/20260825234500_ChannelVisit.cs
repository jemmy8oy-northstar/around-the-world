using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AroundTheWorld.Database.Migrations
{
    /// <inheritdoc />
    public partial class ChannelVisit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ChannelVisitedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChannelVisitedAt",
                table: "Users");
        }
    }
}
