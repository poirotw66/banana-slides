"""
AI Service Prompts - 集中管理所有 AI 服務的 prompt 模板
"""
import json
import logging
from textwrap import dedent
from typing import List, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from services.ai_service import ProjectContext

logger = logging.getLogger(__name__)


# 語言配置映射
LANGUAGE_CONFIG = {
    'zh': {
        'name': '繁體中文',
        'instruction': '請使用全部繁體中文輸出。',
        'ppt_text': 'PPT文字請使用全繁體中文。'
    },
    'ja': {
        'name': '日本語',
        'instruction': 'すべて日本語で出力してください。',
        'ppt_text': 'PPTのテキストは全て日本語で出力してください。'
    },
    'en': {
        'name': 'English',
        'instruction': 'Please output all in English.',
        'ppt_text': 'Use English for PPT text.'
    },
    'auto': {
        'name': '自動',
        'instruction': '',  # 自動模式不新增語言限制
        'ppt_text': ''
    }
}


def get_default_output_language() -> str:
    """
    取得環境變數中配置的預設輸出語言
    
    Returns:
        語言代碼: 'zh', 'ja', 'en', 'auto'
    """
    from config import Config
    return getattr(Config, 'OUTPUT_LANGUAGE', 'zh')


def get_language_instruction(language: str = None) -> str:
    """
    取得語言限制指令文本
    
    Args:
        language: 語言代碼，如果為 None 則使用預設語言
    
    Returns:
        語言限制指令，如果是自動模式則返回空字符串
    """
    lang = language if language else get_default_output_language()
    config = LANGUAGE_CONFIG.get(lang, LANGUAGE_CONFIG['zh'])
    return config['instruction']


def get_ppt_language_instruction(language: str = None) -> str:
    """
    取得PPT文字語言限制指令
    
    Args:
        language: 語言代碼，如果為 None 則使用預設語言
    
    Returns:
        PPT語言限制指令，如果是自動模式則返回空字符串
    """
    lang = language if language else get_default_output_language()
    config = LANGUAGE_CONFIG.get(lang, LANGUAGE_CONFIG['zh'])
    return config['ppt_text']


def _format_reference_files_xml(reference_files_content: Optional[List[Dict[str, str]]]) -> str:
    """
    將參考檔案內容格式化為 XML 結構
    
    Args:
        reference_files_content: List of dicts with 'filename' and 'content' keys
        
    Returns:
        Formatted XML string
    """
    if not reference_files_content:
        return ""
    
    xml_parts = ["<uploaded_files>"]
    for file_info in reference_files_content:
        filename = file_info.get('filename', 'unknown')
        content = file_info.get('content', '')
        xml_parts.append(f'  <file name="{filename}">')
        xml_parts.append('    <content>')
        xml_parts.append(content)
        xml_parts.append('    </content>')
        xml_parts.append('  </file>')
    xml_parts.append('</uploaded_files>')
    xml_parts.append('')  # Empty line after XML
    
    return '\n'.join(xml_parts)


def get_outline_generation_prompt(project_context: 'ProjectContext', language: str = None) -> str:
    """
    生成 PPT 大綱的 prompt
    
    Args:
        project_context: 專案上下文對象，包含所有原始信息
        language: 輸出語言代碼（'zh', 'ja', 'en', 'auto'），如果為 None 則使用預設語言
        
    Returns:
        格式化後的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(project_context.reference_files_content)
    idea_prompt = project_context.idea_prompt or ""
    
    prompt = (f"""\
You are a helpful assistant that generates an outline for a ppt.

You can organize the content in two ways:

1. Simple format (for short PPTs without major sections):
[{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]

2. Part-based format (for longer PPTs with major sections):
[
    {{
    "part": "Part 1: Introduction",
    "pages": [
        {{"title": "Welcome", "points": ["point1", "point2"]}},
        {{"title": "Overview", "points": ["point1", "point2"]}}
    ]
    }},
    {{
    "part": "Part 2: Main Content",
    "pages": [
        {{"title": "Topic 1", "points": ["point1", "point2"]}},
        {{"title": "Topic 2", "points": ["point1", "point2"]}}
    ]
    }}
]

Choose the format that best fits the content. Use parts when the PPT has clear major sections.

The user's request: {idea_prompt}. Now generate the outline, don't include any other text.
{get_language_instruction(language)}
""")
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_outline_generation_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_outline_parsing_prompt(project_context: 'ProjectContext', language: str = None ) -> str:
    """
    解析用戶提供的大綱文本的 prompt
    
    Args:
        project_context: 專案上下文對象，包含所有原始信息
        
    Returns:
        格式化後的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(project_context.reference_files_content)
    outline_text = project_context.outline_text or ""
    
    prompt = (f"""\
You are a helpful assistant that parses a user-provided PPT outline text into a structured format.

The user has provided the following outline text:

{outline_text}

Your task is to analyze this text and convert it into a structured JSON format WITHOUT modifying any of the original text content. 
You should only reorganize and structure the existing content, preserving all titles, points, and text exactly as provided.

You can organize the content in two ways:

1. Simple format (for short PPTs without major sections):
[{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]

2. Part-based format (for longer PPTs with major sections):
[
    {{
    "part": "Part 1: Introduction",
    "pages": [
        {{"title": "Welcome", "points": ["point1", "point2"]}},
        {{"title": "Overview", "points": ["point1", "point2"]}}
    ]
    }},
    {{
    "part": "Part 2: Main Content",
    "pages": [
        {{"title": "Topic 1", "points": ["point1", "point2"]}},
        {{"title": "Topic 2", "points": ["point1", "point2"]}}
    ]
    }}
]

Important rules:
- DO NOT modify, rewrite, or change any text from the original outline
- DO NOT add new content that wasn't in the original text
- DO NOT remove any content from the original text
- Only reorganize the existing content into the structured format
- Preserve all titles, bullet points, and text exactly as they appear
- If the text has clear sections/parts, use the part-based format
- Extract titles and points from the original text, keeping them exactly as written

Now parse the outline text above into the structured format. Return only the JSON, don't include any other text.
{get_language_instruction(language)}
""")
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_outline_parsing_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_page_description_prompt(project_context: 'ProjectContext', outline: list, 
                                page_outline: dict, page_index: int, 
                                part_info: str = "",
                                language: str = None) -> str:
    """
    生成單個頁面描述的 prompt
    
    Args:
        project_context: 專案上下文對象，包含所有原始信息
        outline: 完整大綱
        page_outline: 當前頁面的大綱
        page_index: 頁面編號（從 1 開始）
        part_info: 可選的章節信息
        
    Returns:
        格式化後的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(project_context.reference_files_content)
    # 根據專案類別選擇最相關的原始輸入
    if project_context.creation_type == 'idea' and project_context.idea_prompt:
        original_input = project_context.idea_prompt
    elif project_context.creation_type == 'outline' and project_context.outline_text:
        original_input = f"用戶提供的大綱：\n{project_context.outline_text}"
    elif project_context.creation_type == 'descriptions' and project_context.description_text:
        original_input = f"用戶提供的描述：\n{project_context.description_text}"
    else:
        original_input = project_context.idea_prompt or ""
    
    prompt = (f"""\
我們正在為 PPT 的每一頁生成內容描述。
用戶的原始需求是：\n{original_input}\n
我們已經有了完整的大綱：\n{outline}\n{part_info}
現在請為第 {page_index} 頁生成描述：
{page_outline}

【重要提示】生成的"頁面文字"部分會直接渲染到 PPT 頁面上，因此請務必注意：
1. 文字內容要簡潔精煉，每條要點控制在 15-25 字以內
2. 條理清晰，使用列表形式組織內容
3. 避免冗長的句子和複雜的表述
4. 確保內容可讀性強，適合在演示時展示
5. 不要包含任何額外的說明性文字或註釋

輸出格式示例：
頁面標題：原始社會：與自然共生

頁面文字：
- 狩獵採集文明：人類活動規模小，對環境影響有限
- 依賴性強：生活完全依賴自然資源的直接供給
- 適應而非改造：通過觀察學習自然，發展生存技能
- 影響特點：局部、短期、低強度，生態可自我恢復

其他頁面素材（如果有請積極添加，包括 markdown 圖片鏈接、公式、表格等）

【關於圖片】如果參考檔案中包含以 /files/ 開頭的本機檔案 URL 圖片（例如 /files/mineru/xxx/image.png），請將這些圖片以 markdown 格式輸出，例如：![圖片描述](/files/mineru/xxx/image.png)。這些圖片會被包含在 PPT 頁面中。

{get_language_instruction(language)}
""")
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_page_description_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_image_generation_prompt(page_desc: str, outline_text: str, 
                                current_section: str,
                                has_material_images: bool = False,
                                extra_requirements: str = None,
                                language: str = None) -> str:
    """
    生成圖片生成 prompt
    
    Args:
        page_desc: 頁面描述文本
        outline_text: 大綱文本
        current_section: 當前章節
        has_material_images: 是否有素材圖片
        extra_requirements: 額外的要求
        
    Returns:
        格式化后的 prompt 字符串
    """
    # 如果有素材圖片，在 prompt 中明確告知 AI
    material_images_note = ""
    if has_material_images:
        material_images_note = (
            "\n\n提示：除了模板參考圖片（用於風格參考）外，還提供了額外的素材圖片。"
            "這些素材圖片是可供挑選和使用的元素，你可以從這些素材圖片中選擇合適的圖片、圖標、圖表或其他視覺元素"
            "直接整合到生成的 PPT 頁面中。請根據頁面內容的需要，智能地選擇和組合這些素材圖片中的元素。"
        )
    
    # 添加額外要求到提示詞
    extra_req_text = ""
    if extra_requirements and extra_requirements.strip():
        extra_req_text = f"\n\n額外要求（請務必遵循）：\n{extra_requirements}\n"

# 該處參考了@歸藏的 AI 工具箱
    prompt = (f"""\
你是一位專家級 UI UX 演示設計師，專注於生成設計良好的 PPT 頁面。
當前 PPT 頁面的頁面描述如下:
<page_description>
{page_desc}
</page_description>

<reference_information>
整個 PPT 的大綱為：
{outline_text}

當前位於章節：{current_section}
</reference_information>


<design_guidelines>
- 要求文字清晰銳利, 畫面為 4K 分辨率，16:9 比例。
- 配色和設計語言和模板圖片嚴格相似。
- 根據內容自動設計最完美的構圖，不重不漏地渲染"頁面描述"中的文本。
- 如非必要，禁止出現 markdown 格式符號（如 # 和 * 等）。
- 只參考風格設計，禁止出現模板中的文字。
- 使用大小恰當的裝飾性圖形或插畫對空缺位置進行填補。
</design_guidelines>
{get_ppt_language_instruction(language)}
{material_images_note}{extra_req_text}
""")
    
    logger.debug(f"[get_image_generation_prompt] Final prompt:\n{prompt}")
    return prompt


def get_image_edit_prompt(edit_instruction: str, original_description: str = None) -> str:
    """
    生成圖片編輯 prompt
    
    Args:
        edit_instruction: 編輯指令
        original_description: 原始頁面描述（可選）
        
    Returns:
        格式化后的 prompt 字符串
    """
    if original_description:
        # 刪除"其他頁面素材："之後的內容，避免被前面的圖影響
        if "其他頁面素材" in original_description:
            original_description = original_description.split("其他頁面素材")[0].strip()
        
        prompt = (f"""\
該 PPT 頁面的原始頁面描述為：
{original_description}

現在，根據以下指令修改這張 PPT 頁面：{edit_instruction}

要求維持原有的文字內容和設計風格，只按照指令進行修改。提供的參考圖中既有新素材，也有用戶手動框選出的區域，請你根據原圖和參考圖的關係智能判斷用戶意圖。
""")
    else:
        prompt = f"根據以下指令修改這張 PPT 頁面：{edit_instruction}\n保持原有的內容結構和設計風格，只按照指令進行修改。提供的參考圖中既有新素材，也有用戶手動框選出的區域，請你根據原圖和參考圖的關係智能判斷用戶意圖。"
    
    logger.debug(f"[get_image_edit_prompt] Final prompt:\n{prompt}")
    return prompt


def get_description_to_outline_prompt(project_context: 'ProjectContext', language: str = None) -> str:
    """
    從描述文本解析出大綱的 prompt
    
    Args:
        project_context: 專案上下文對象，包含所有原始信息
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(project_context.reference_files_content)
    description_text = project_context.description_text or ""
    
    prompt = (f"""\
You are a helpful assistant that analyzes a user-provided PPT description text and extracts the outline structure from it.

The user has provided the following description text:

{description_text}

Your task is to analyze this text and extract the outline structure (titles and key points) for each page.
You should identify:
1. How many pages are described
2. The title for each page
3. The key points or content structure for each page

You can organize the content in two ways:

1. Simple format (for short PPTs without major sections):
[{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]

2. Part-based format (for longer PPTs with major sections):
[
    {{
    "part": "Part 1: Introduction",
    "pages": [
        {{"title": "Welcome", "points": ["point1", "point2"]}},
        {{"title": "Overview", "points": ["point1", "point2"]}}
    ]
    }},
    {{
    "part": "Part 2: Main Content",
    "pages": [
        {{"title": "Topic 1", "points": ["point1", "point2"]}},
        {{"title": "Topic 2", "points": ["point1", "point2"]}}
    ]
    }}
]

Important rules:
- Extract the outline structure from the description text
- Identify page titles and key points
- If the text has clear sections/parts, use the part-based format
- Preserve the logical structure and organization from the original text
- The points should be concise summaries of the main content for each page

Now extract the outline structure from the description text above. Return only the JSON, don't include any other text.
{get_language_instruction(language)}
""")
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_description_to_outline_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_description_split_prompt(project_context: 'ProjectContext', 
                                 outline: List[Dict], 
                                 language: str = None) -> str:
    """
    從描述文本切分出每頁描述的 prompt
    
    Args:
        project_context: 專案上下文對象，包含所有原始信息
        outline: 已解析出的大綱結構
        
    Returns:
        格式化后的 prompt 字符串
    """
    outline_json = json.dumps(outline, ensure_ascii=False, indent=2)
    description_text = project_context.description_text or ""
    
    prompt = (f"""\
You are a helpful assistant that splits a complete PPT description text into individual page descriptions.

The user has provided a complete description text:

{description_text}

We have already extracted the outline structure:

{outline_json}

Your task is to split the description text into individual page descriptions based on the outline structure.
For each page in the outline, extract the corresponding description from the original text.

Return a JSON array where each element corresponds to a page in the outline (in the same order).
Each element should be a string containing the page description in the following format:

頁面標題：[頁面標題]

頁面文字：
- [要點1]
- [要點2]
...

Example output format:
[
    "頁標題：人工智慧的誕生\\n頁面文字：\\n- 1950 年，圖靈提出"圖靈測試"...",
    "頁標題：AI 的發展歷程\\n頁文字：\\n- 1950年代：符號主義...",
    ...
]

Important rules:
- Split the description text according to the outline structure
- Each page description should match the corresponding page in the outline
- Preserve all important content from the original text
- Keep the format consistent with the example above
- If a page in the outline doesn't have a clear description in the text, create a reasonable description based on the outline

Now split the description text into individual page descriptions. Return only the JSON array, don't include any other text.
{get_language_instruction(language)}
""")
    
    logger.debug(f"[get_description_split_prompt] Final prompt:\n{prompt}")
    return prompt


def get_outline_refinement_prompt(current_outline: List[Dict], user_requirement: str,
                                   project_context: 'ProjectContext',
                                   previous_requirements: Optional[List[str]] = None,
                                   language: str = None) -> str:
    """
    根據用戶要求修改已有大綱的 prompt
    
    Args:
        current_outline: 當前的大綱結構
        user_requirement: 用戶的新要求
        project_context: 專案上下文對象，包含所有原始信息
        previous_requirements: 之前的修改要求列表（可選）
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(project_context.reference_files_content)
    
    # 处理空大纲的情况
    if not current_outline or len(current_outline) == 0:
        outline_text = "(当前没有内容)"
    else:
        outline_text = json.dumps(current_outline, ensure_ascii=False, indent=2)
    
    # 構建之前的修改歷史記錄
    previous_req_text = ""
    if previous_requirements and len(previous_requirements) > 0:
        prev_list = "\n".join([f"- {req}" for req in previous_requirements])
        previous_req_text = f"\n\n之前用户提出的修改要求：\n{prev_list}\n"
    
    # 構建原始輸入信息（根據專案類別顯示不同的原始內容）
    original_input_text = "\n原始輸入信息：\n"
    if project_context.creation_type == 'idea' and project_context.idea_prompt:
        original_input_text += f"- PPT 構想：{project_context.idea_prompt}\n"
    elif project_context.creation_type == 'outline' and project_context.outline_text:
        original_input_text += f"- 用户提供的大綱文本：\n{project_context.outline_text}\n"
    elif project_context.creation_type == 'descriptions' and project_context.description_text:
        original_input_text += f"- 用户提供的页面描述文本：\n{project_context.description_text}\n"
    elif project_context.idea_prompt:
        original_input_text += f"- 用户输入：{project_context.idea_prompt}\n"
    
    prompt = (f"""\
You are a helpful assistant that modifies PPT outlines based on user requirements.
{original_input_text}
當前的 PPT 大綱結構如下：

{outline_text}
{previous_req_text}
**用戶現在提出新的要求：{user_requirement}**

請根據用戶的要求修改和調整大綱。你可以：
- 添加、刪除或重新排列頁面
- 修改頁面標題和要點
- 調整頁面的組織結構
- 添加或刪除章節（part）
- 合併或拆分頁面
- 根據用戶要求進行任何合理的調整
- 如果當前沒有內容，請根據用戶要求和原始輸入信息創建新的大綱

輸出格式可以選擇：

1. 簡單格式（適用於沒有主要章節的短 PPT）：
[{{"title": "title1", "points": ["point1", "point2"]}}, {{"title": "title2", "points": ["point1", "point2"]}}]

2. 基於章節的格式（適用於有明確主要章節的長 PPT）：
[
    {{
    "part": "第一部分：引言",
    "pages": [
        {{"title": "歡迎", "points": ["point1", "point2"]}},
        {{"title": "概述", "points": ["point1", "point2"]}}
    ]
    }},
    {{
    "part": "第二部分：主要內容",
    "pages": [
        {{"title": "主題1", "points": ["point1", "point2"]}},
        {{"title": "主題2", "points": ["point1", "point2"]}}
    ]
    }}
]

選擇最適合內容的格式。當 PPT 有清晰的主要章節時使用章節格式。

現在請根據用戶要求修改大綱，只輸出 JSON 格式的大綱，不要包含其他文字。
{get_language_instruction(language)}
""")
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_outline_refinement_prompt] Final prompt:\n{final_prompt}")
    return final_prompt


def get_descriptions_refinement_prompt(current_descriptions: List[Dict], user_requirement: str,
                                       project_context: 'ProjectContext',
                                       outline: List[Dict] = None,
                                       previous_requirements: Optional[List[str]] = None,
                                       language: str = None) -> str:
    """
    根據用戶要求修改已有頁面描述的 prompt
    
    Args:
        current_descriptions: 當前的頁面描述列表，每個元素包含 {index, title, description_content}
        user_requirement: 用戶的新要求
        project_context: 專案上下文對象，包含所有原始信息
        outline: 完整的大綱結構（可選）
        previous_requirements: 之前的修改要求列表（可選）
        
    Returns:
        格式化后的 prompt 字符串
    """
    files_xml = _format_reference_files_xml(project_context.reference_files_content)
    
    # 構建之前的修改歷史記錄
    previous_req_text = ""
    if previous_requirements and len(previous_requirements) > 0:
        prev_list = "\n".join([f"- {req}" for req in previous_requirements])
        previous_req_text = f"\n\n之前用户提出的修改要求：\n{prev_list}\n"
    
    # 構建原始輸入信息
    original_input_text = "\n原始輸入信息：\n"
    if project_context.creation_type == 'idea' and project_context.idea_prompt:
        original_input_text += f"- PPT 構想：{project_context.idea_prompt}\n"
    elif project_context.creation_type == 'outline' and project_context.outline_text:
        original_input_text += f"- 用户提供的大綱文本：\n{project_context.outline_text}\n"
    elif project_context.creation_type == 'descriptions' and project_context.description_text:
        original_input_text += f"- 用户提供的頁面描述文本：\n{project_context.description_text}\n"
    elif project_context.idea_prompt:
        original_input_text += f"- 用户輸入：{project_context.idea_prompt}\n"
    
    # 構建大綱文本
    outline_text = ""
    if outline:
        outline_json = json.dumps(outline, ensure_ascii=False, indent=2)
        outline_text = f"\n\n完整的 PPT 大綱：\n{outline_json}\n"
    
    # 構建所有頁面描述的彙總
    all_descriptions_text = "當前所有頁面的描述：\n\n"
    has_any_description = False
    for desc in current_descriptions:
        page_num = desc.get('index', 0) + 1
        title = desc.get('title', '未命名')
        content = desc.get('description_content', '')
        if isinstance(content, dict):
            content = content.get('text', '')
        
        if content:
            has_any_description = True
            all_descriptions_text += f"--- 第 {page_num} 頁：{title} ---\n{content}\n\n"
        else:
            all_descriptions_text += f"--- 第 {page_num} 頁：{title} ---\n(當前沒有內容)\n\n"
    
    if not has_any_description:
        all_descriptions_text = "當前所有頁面的描述：\n\n(當前沒有內容，需要基於大綱生成新的描述)\n\n"
    
    prompt = (f"""\
You are a helpful assistant that modifies PPT page descriptions based on user requirements.
{original_input_text}{outline_text}
{all_descriptions_text}
{previous_req_text}
**用戶現在提出新的要求：{user_requirement}**

請根據用戶的要求修改和調整所有頁面的描述。你可以：
- 修改頁面標題和內容
- 調整頁面文字的詳細程度
- 添加或刪除要點
- 調整描述的結構和表達
- 確保所有頁面描述都符合用戶的要求
- 如果當前沒有內容，請根據大綱和用戶要求創建新的描述

請為每個頁面生成修改後的描述，格式如下：

頁面標題：[頁面標題]

頁面文字：
- [要點1]
- [要點2]
...
其他頁面素材（如果有請加上，包括 markdown 圖片鏈接等）

提示：如果參考檔案中包含以 /files/ 開頭的本機檔案 URL 圖片（例如 /files/mineru/xxx/image.png），請將這些圖片以 markdown 格式輸出，例如：![圖片描述](/files/mineru/xxx/image.png)，而不是作為普通文本。

請返回一個 JSON 數組，每個元素是一個字符串，對應每個頁面的修改後描述（按頁面順序）。

示例輸出格式：
[
    "頁面標題：人工智能的誕生\\n頁面文字：\\n- 1950 年，圖靈提出\\"圖靈測試\\"...",
    "頁面標題：AI 的發展歷程\\n頁面文字：\\n- 1950 年代：符號主義...",
    ...
]

現在請根據用戶要求修改所有頁面描述，只輸出 JSON 數組，不要包含其他文字。
{get_language_instruction(language)}
""")
    
    final_prompt = files_xml + prompt
    logger.debug(f"[get_descriptions_refinement_prompt] Final prompt:\n{final_prompt}")
    return final_prompt
