using Microsoft.SemanticKernel; // 确保 Kernel, KernelArguments, KernelException 等类型可用
using Microsoft.SemanticKernel.Connectors.OpenAI; // For OpenAIPromptExecutionSettings

namespace StudyRecord.Services
{
    public class SemanticKernelService
    {
        private readonly Kernel _kernel;
        private readonly ILogger<SemanticKernelService> _logger;
        public SemanticKernelService(IConfiguration configuration, ILogger<SemanticKernelService> logger)
        {
            _logger = logger;
            var builder = Kernel.CreateBuilder();
            var apiKey = configuration["ApiKey"];
            var modelId = configuration["ModelId"];
            var baseUrl = configuration["LLMBaseUrl"];

            if (string.IsNullOrEmpty(modelId))
            {
                modelId = "gpt-4";
            }
            if (string.IsNullOrEmpty(baseUrl))
            {
                baseUrl = "https://api.openai.com/v1";
            }

            var endpointUrl = new Uri(baseUrl);
            var httpClientHandler = new HttpClientHandler
            {
                AllowAutoRedirect = true,
                MaxAutomaticRedirections = 3,
            };

            var httpClient = new HttpClient(httpClientHandler)
            {
                Timeout = TimeSpan.FromSeconds(16000), // 示例超时时间
            };


            builder.AddOpenAIChatCompletion(
                modelId,
                endpointUrl,
                apiKey, // 提供一个虚拟密钥
                httpClient: httpClient);

            _logger.LogInformation($"Initialized Ollama with ModelId: {modelId}, Endpoint: {baseUrl}, and custom HttpClient.");

            _kernel = builder.Build();
            _logger.LogInformation("Semantic Kernel built successfully.");
        }

        public async Task<string> GenerateResponseAsync(string inputText, string operation) // 将 'prompt' 重命名为 'inputText' 以提高清晰度
        {
            try
            {
                var templateName = operation; // 使用操作名称作为模板名称
                var item = PromptsTemplate.Instance.GetTemplateContent(templateName);

                var prompt = item.Content.Replace("{{inputText}}", inputText);
                var promptSettings = new OpenAIPromptExecutionSettings
                {
                    Temperature = 0.7f,
                    MaxTokens = 1000,
                    TopP = 1.0f,
                };
                var kernelArgs = new KernelArguments(promptSettings);
                var result = await _kernel.InvokePromptAsync(prompt, kernelArgs);
                var retStr = result.ToString();
                _logger.LogInformation("Response generated successfully for operation '{Operation}'.", operation);
                return retStr;
            }
            catch (KernelException ex)
            {
                //捕获 Semantic Kernel 特有的异常
                _logger.LogError(ex, "KernelException during response generation for operation '{Operation}'.", operation);
                return $"生成失败 (Kernel Error): {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during response generation for operation '{Operation}'.", operation);
                return $"生成失败: {ex.Message}";
            }
        }
    }
}
