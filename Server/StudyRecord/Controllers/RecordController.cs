using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StudyRecord.Services; // 添加：SemanticKernelService 的命名空间
using System;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace StudyRecord.Service
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class RecordController : ControllerBase
    {
        private readonly SemanticKernelService _semanticKernelService;

        public RecordController(SemanticKernelService semanticKernelService)
        {
            _semanticKernelService = semanticKernelService;
        }

        public class Record
        {
            [JsonPropertyName("opName")]
            public string OpName { get; set; }

            [JsonPropertyName("text")]
            public string Text { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> NewRecord(Record record)
        {
            // 验证请求数据
            if (string.IsNullOrEmpty(record.OpName) || string.IsNullOrEmpty(record.Text))
            {
                return BadRequest("操作名或文本内容不能为空");
            }

            // 调用Semantic Kernel
            string aiResponse;
            try
            {
                aiResponse = await _semanticKernelService.GenerateResponseAsync(record.Text, record.OpName);
            }
            catch (Exception ex)
            {
                aiResponse = $"AI服务调用失败: {ex.Message}";
            }

            // 处理请求
            var result = new
            {
                Status = "success",
                Message = $"收到'{record.OpName}'操作请求",
                ReceivedAt = DateTime.Now,
                AIResponse = aiResponse
            };

            return Ok(result);
        }

        [HttpGet]
        public string[] GetOpList()
        {
            var tepmates = PromptsTemplate.Instance.GetTemplateNames();
            Console.WriteLine("GetOpList called - tepmates: " + string.Join(", ", tepmates));
            return tepmates;
        }
    }
}
