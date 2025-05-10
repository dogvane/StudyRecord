using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace StudyRecord.Services
{

    public class TemplateItem
    {
        /// <summary>
        /// 提示词模板的名称
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// 提示词模板的内容
        /// </summary>
        public string Content { get; set; }

        /// <summary>
        /// 提示词模板有哪些可替换的输入项
        /// 他在模板中用 {{name}} 的形式表示
        /// </summary>
        public string[] InputNames { get; set; }
    }

    /// <summary>
    /// 提示词模板类
    /// </summary>
    /// <remarks>
    /// 提供了从文件里获得提示词模板的功能。
    /// </remarks>
    public class PromptsTemplate
    {
        
        private PromptsTemplate()
        {

        }

        /// <summary>
        /// 提示词模板列表
        /// </summary>
        /// <value></value>
        public TemplateItem[] Prompts { get; private set; }

        void Init(string BaseDirectory)
        {
            // 提示词模板是从文件目录里加载的
            // 这里的文件目录是相对路径
            // 结构是 目录名作为提示词模板的名称
            // 目录下有一个 prompts.txt 文件，作为提示词模板的内容
            // 加载后，读取提示词模板的内容，将 {{}} 内的内容作为 InputNames

            // 初始化后，需要监听文件变化，如果文件变化了，就重新加载
            List<TemplateItem> prompts = new List<TemplateItem>();
            foreach (var promptFolder in Directory.GetDirectories(BaseDirectory))
            {
                // 日志
                Console.WriteLine($"Loading prompt template from {promptFolder}");

                var name = Path.GetFileName(promptFolder);
                var content = File.ReadAllText(Path.Combine(promptFolder, "prompts.txt"));
                var inputNames = content.Split(new[] { '{', '}' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(s => s.Length > 0)
                    .Select(s => s.Trim())
                    .ToArray();
                prompts.Add(new TemplateItem
                {
                    Name = name,
                    Content = content,
                    InputNames = inputNames
                });
            }

            Prompts = prompts.ToArray();

            // 监听文件变化
            FileSystemWatcher watcher = new FileSystemWatcher(BaseDirectory);
            watcher.NotifyFilter = NotifyFilters.LastWrite;
            watcher.Filter = "*.txt";
            watcher.Changed += (s, e) =>
            {
                // 文件变化了，重新加载
                Init(BaseDirectory);
            };
            watcher.EnableRaisingEvents = true;
            watcher.IncludeSubdirectories = true;
        }


        static PromptsTemplate _instance;

        public static PromptsTemplate Instance
        {
            get
            {
                if (_instance == null)
                {
                    // 静态构造函数
                    _instance = new PromptsTemplate();
                    var BaseDirectory = GetPromptDirectory();
                    _instance.Init(BaseDirectory);
                }

                return _instance;
            }
        }

        private static string GetPromptDirectory()
        {
            var BaseDirectory =AppContext.BaseDirectory;
            if (!Directory.Exists(Path.Combine(BaseDirectory, "Prompts")))
            {
                // 如果目录不存在，可能是debug时的启动目录不存在，可以尝试向上找3层
                for (int i = 0; i < 3; i++)
                {
                    BaseDirectory = Path.Combine(BaseDirectory, "..");
                    if (Directory.Exists(Path.Combine(BaseDirectory, "Prompts")))
                    {
                        break;
                    }
                }
            }

            // 如果目录还是不存在，抛出异常
            if (!Directory.Exists(Path.Combine(BaseDirectory, "Prompts")))
            {
                throw new Exception($"提示词模板目录 {BaseDirectory}/Prompts 不存在");
            }

            Console.WriteLine("PromptsTemplate static constructor called - BaseDirectory: " + BaseDirectory);

            return Path.Combine(BaseDirectory, "Prompts");
        }

        public string[] GetTemplateNames()
        {
            // 返回所有提示词模板的名称
            return Prompts.Select(p => p.Name).ToArray();
        }

        public TemplateItem GetTemplateContent(string name)
        {
            // 返回指定名称的提示词模板的内容
            var template = Prompts.FirstOrDefault(p => p.Name == name);
            if (template != null)
            {
                return template;
            }
            else
            {
                throw new Exception($"提示词模板 {name} 不存在");
            }
        }
    }

}