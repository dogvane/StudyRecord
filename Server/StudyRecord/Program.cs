namespace StudyRecord
{
    using StudyRecord.Services; // 添加此行引用服务命名空间
    using Microsoft.Extensions.DependencyInjection; // 添加此行以使用 GetRequiredService

    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddAuthorization();
            builder.Services.AddEndpointsApiExplorer();

            // 添加控制器支持
            builder.Services.AddControllers();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowChromeExtension", builder =>
                {
                    builder.AllowAnyOrigin()
                           .AllowAnyMethod()
                           .AllowAnyHeader();
                });
            });
            // 注册 HttpClient
            builder.Services.AddHttpClient();

            // 注册 SemanticKernelService
            builder.Services.AddSingleton<SemanticKernelService>();

            var app = builder.Build();

            app.UseAuthorization();

            app.UseRouting();
            app.UseCors("AllowExtension");
            app.UseCors("AllowChromeExtension");

            // 添加控制器端点
            app.MapControllers();

            app.Run();
        }
    }
}
