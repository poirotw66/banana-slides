import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, FileEdit, ImagePlus, Paperclip, Palette, Lightbulb, Search, Settings } from 'lucide-react';
import { Button, Textarea, Card, useToast, MaterialGeneratorModal, ReferenceFileList, ReferenceFileSelector, FilePreviewModal, ImagePreviewList } from '@/components/shared';
import { TemplateSelector, getTemplateFile } from '@/components/shared/TemplateSelector';
import { listUserTemplates, type UserTemplate, uploadReferenceFile, type ReferenceFile, associateFileToProject, triggerFileParse, uploadMaterial, associateMaterialsToProject } from '@/api/endpoints';
import { useProjectStore } from '@/store/useProjectStore';

type CreationType = 'idea' | 'outline' | 'description';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { initializeProject, isGlobalLoading } = useProjectStore();
  const { show, ToastContainer } = useToast();
  
  const [activeTab, setActiveTab] = useState<CreationType>('idea');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 檢查是否有當前專案 & 載入使用者範本
  useEffect(() => {
    const projectId = localStorage.getItem('currentProjectId');
    setCurrentProjectId(projectId);
    
    // 載入使用者範本列表（用於按需獲取File）
    const loadTemplates = async () => {
      try {
        const response = await listUserTemplates();
        if (response.data?.templates) {
          setUserTemplates(response.data.templates);
        }
      } catch (error) {
        console.error('載入使用者範本失敗:', error);
      }
    };
    loadTemplates();
  }, []);

  const handleOpenMaterialModal = () => {
    // 在主頁始終生成全域素材，不關聯任何專案
    setIsMaterialModalOpen(true);
  };

  // 檢測貼上事件，自動上傳檔案和圖片
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    console.log('Paste event triggered');
    const items = e.clipboardData?.items;
    if (!items) {
      console.log('No clipboard items');
      return;
    }

    console.log('Clipboard items:', items.length);
    
    // 檢查是否有檔案或圖片
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`Item ${i}:`, { kind: item.kind, type: item.type });
      
      if (item.kind === 'file') {
        const file = item.getAsFile();
        console.log('Got file:', file);
        
        if (file) {
          console.log('File details:', { name: file.name, type: file.type, size: file.size });
          
          // 檢查是否是圖片
          if (file.type.startsWith('image/')) {
            console.log('Image detected, uploading...');
            e.preventDefault(); // 阻止預設貼上行為
            await handleImageUpload(file);
            return;
          }
          
          // 檢查檔案類型（參考檔案）
          const allowedExtensions = ['pdf', 'docx', 'pptx', 'doc', 'ppt', 'xlsx', 'xls', 'csv', 'txt', 'md'];
          const fileExt = file.name.split('.').pop()?.toLowerCase();
          
          console.log('File extension:', fileExt);
          
          if (fileExt && allowedExtensions.includes(fileExt)) {
            console.log('File type allowed, uploading...');
            e.preventDefault(); // 阻止預設貼上行為
            await handleFileUpload(file);
          } else {
            console.log('File type not allowed');
            show({ message: `不支援的檔案類型: ${fileExt}`, type: 'info' });
          }
        }
      }
    }
  };

  // 上傳圖片
  // 在 Home 頁面，圖片始終上傳為全域素材（不關聯專案），因為此時還沒有專案
  const handleImageUpload = async (file: File) => {
    if (isUploadingFile) return;

    setIsUploadingFile(true);
    try {
      // 顯示上傳中提示
      show({ message: '正在上傳圖片...', type: 'info' });
      
      // 儲存當前游標位置
      const cursorPosition = textareaRef.current?.selectionStart || content.length;
      
      // 上傳圖片到素材庫（全域素材）
      const response = await uploadMaterial(file, null);
      
      if (response?.data?.url) {
        const imageUrl = response.data.url;
        
        // 產生markdown圖片連結
        const markdownImage = `![image](${imageUrl})`;
        
        // 在游標位置插入圖片連結
        setContent(prev => {
          const before = prev.slice(0, cursorPosition);
          const after = prev.slice(cursorPosition);
          
          // 如果游標前有內容且不以換行結尾，添加換行
          const prefix = before && !before.endsWith('\n') ? '\n' : '';
          // 如果游標後有內容且不以換行開頭，添加換行
          const suffix = after && !after.startsWith('\n') ? '\n' : '';
          
          return before + prefix + markdownImage + suffix + after;
        });
        
        // 恢復游標位置（移動到插入內容之後）
        setTimeout(() => {
          if (textareaRef.current) {
            const newPosition = cursorPosition + (content.slice(0, cursorPosition) && !content.slice(0, cursorPosition).endsWith('\n') ? 1 : 0) + markdownImage.length;
            textareaRef.current.selectionStart = newPosition;
            textareaRef.current.selectionEnd = newPosition;
            textareaRef.current.focus();
          }
        }, 0);
        
        show({ message: '圖片上傳成功！已插入到游標位置', type: 'success' });
      } else {
        show({ message: '圖片上傳失敗：未返回圖片資訊', type: 'error' });
      }
    } catch (error: any) {
      console.error('圖片上傳失敗:', error);
      show({ 
        message: `圖片上傳失敗: ${error?.response?.data?.error?.message || error.message || '未知錯誤'}`, 
        type: 'error' 
      });
    } finally {
      setIsUploadingFile(false);
    }
  };

  // 上傳檔案
  // 在 Home 頁面，檔案始終上傳為全域檔案（不關聯專案），因為此時還沒有專案
  const handleFileUpload = async (file: File) => {
    if (isUploadingFile) return;

    // 檢查檔案大小（前端預檢查）
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      show({ 
        message: `檔案過大：${(file.size / 1024 / 1024).toFixed(1)}MB，最大支援 200MB`, 
        type: 'error' 
      });
      return;
    }

    // 檢查是否是PPT檔案，提示建議使用PDF
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt === 'ppt' || fileExt === 'pptx') 
      show({  message: '💡 提示：建議將PPT轉換為PDF格式上傳，可獲得更好的解析效果',    type: 'info' });
    
    setIsUploadingFile(true);
    try {
      // 在 Home 頁面，始終上傳為全域檔案
      const response = await uploadReferenceFile(file, null);
      if (response?.data?.file) {
        const uploadedFile = response.data.file;
        setReferenceFiles(prev => [...prev, uploadedFile]);
        show({ message: '檔案上傳成功', type: 'success' });
        
        // 如果檔案狀態為 pending，自動觸發解析
        if (uploadedFile.parse_status === 'pending') {
          try {
            const parseResponse = await triggerFileParse(uploadedFile.id);
            // 使用解析介面返回的檔案物件更新狀態
            if (parseResponse?.data?.file) {
              const parsedFile = parseResponse.data.file;
              setReferenceFiles(prev => 
                prev.map(f => f.id === uploadedFile.id ? parsedFile : f)
              );
            } else {
              // 如果沒有返回檔案物件，手動更新狀態為 parsing（非同步執行緒會稍後更新）
              setReferenceFiles(prev => 
                prev.map(f => f.id === uploadedFile.id ? { ...f, parse_status: 'parsing' as const } : f)
              );
            }
          } catch (parseError: any) {
            console.error('觸發檔案解析失敗:', parseError);
            // 解析觸發失敗不影響上傳成功提示
          }
        }
      } else {
        show({ message: '檔案上傳失敗：未返回檔案資訊', type: 'error' });
      }
    } catch (error: any) {
      console.error('檔案上傳失敗:', error);
      
      // 特殊處理413錯誤
      if (error?.response?.status === 413) {
        show({ 
          message: `檔案過大：${(file.size / 1024 / 1024).toFixed(1)}MB，最大支援 200MB`, 
          type: 'error' 
        });
      } else {
        show({ 
          message: `檔案上傳失敗: ${error?.response?.data?.error?.message || error.message || '未知錯誤'}`, 
          type: 'error' 
        });
      }
    } finally {
      setIsUploadingFile(false);
    }
  };

  // 從當前專案移除檔案引用（不刪除檔案本身）
  const handleFileRemove = (fileId: string) => {
    setReferenceFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 檔案狀態變化回呼
  const handleFileStatusChange = (updatedFile: ReferenceFile) => {
    setReferenceFiles(prev => 
      prev.map(f => f.id === updatedFile.id ? updatedFile : f)
    );
  };

  // 點擊迴紋針按鈕 - 開啟檔案選擇器
  const handlePaperclipClick = () => {
    setIsFileSelectorOpen(true);
  };

  // 從選擇器選擇檔案後的回呼
  const handleFilesSelected = (selectedFiles: ReferenceFile[]) => {
    // 合併新選擇的檔案到列表（去重）
    setReferenceFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const newFiles = selectedFiles.filter(f => !existingIds.has(f.id));
      // 合併時，如果檔案已存在，更新其狀態（可能解析狀態已改變）
      const updated = prev.map(f => {
        const updatedFile = selectedFiles.find(sf => sf.id === f.id);
        return updatedFile || f;
      });
      return [...updated, ...newFiles];
    });
    show({ message: `已添加 ${selectedFiles.length} 個參考檔案`, type: 'success' });
  };

  // 獲取當前已選擇的檔案ID列表，傳遞給選擇器（使用 useMemo 避免每次渲染都重新計算）
  const selectedFileIds = useMemo(() => {
    return referenceFiles.map(f => f.id);
  }, [referenceFiles]);

  // 從編輯框內容中移除指定的圖片markdown連結
  const handleRemoveImage = (imageUrl: string) => {
    setContent(prev => {
      // 移除所有匹配該URL的markdown圖片連結
      const imageRegex = new RegExp(`!\\[[^\\]]*\\]\\(${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
      let newContent = prev.replace(imageRegex, '');
      
      // 清理多餘的空行（最多保留一個空行）
      newContent = newContent.replace(/\n{3,}/g, '\n\n');
      
      return newContent.trim();
    });
    
    show({ message: '已移除圖片', type: 'success' });
  };

  // 檔案選擇變化
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await handleFileUpload(files[i]);
    }

    // 清空 input，允許重複選擇同一檔案
    e.target.value = '';
  };

  const tabConfig = {
    idea: {
      icon: <Sparkles size={20} />,
      label: '一句話生成',
      placeholder: '例如：生成一份關於 AI 發展史的演講 PPT',
      description: '輸入你的想法，AI 將為你生成完整的 PPT',
    },
    outline: {
      icon: <FileText size={20} />,
      label: '從大綱生成',
      placeholder: '貼上你的 PPT 大綱...\n\n例如：\n第一部分：AI 的起源\n- 1950 年代的開端\n- 達特茅斯會議\n\n第二部分：發展歷程\n...',
      description: '已有大綱？直接貼上即可快速生成，AI 將自動切分為結構化大綱',
    },
    description: {
      icon: <FileEdit size={20} />,
      label: '從描述生成',
      placeholder: '貼上你的完整頁面描述...\n\n例如：\n第 1 頁\n標題：人工智慧的誕生\n內容：1950 年，圖靈提出“圖靈測試”...\n\n第 2 頁\n標題：AI 的發展歷程\n內容：1950年代：符號主義...\n...',
      description: '已有完整描述？AI 將自動解析出大綱並切分為每頁描述，直接生成圖片',
    },
  };

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    // 總是設定檔案（如果提供）
    if (templateFile) {
      setSelectedTemplate(templateFile);
    }
    
    // 處理範本 ID
    if (templateId) {
      // 判斷是使用者範本還是預設範本
      // 預設範本 ID 通常是 '1', '2', '3' 等短字串
      // 使用者範本 ID 通常較長（UUID 格式）
      if (templateId.length <= 3 && /^\d+$/.test(templateId)) {
        // 預設範本
        setSelectedPresetTemplateId(templateId);
        setSelectedTemplateId(null);
      } else {
        // 使用者範本
        setSelectedTemplateId(templateId);
        setSelectedPresetTemplateId(null);
      }
    } else {
      // 如果沒有 templateId，可能是直接上傳的檔案
      // 清空所有選擇狀態
      setSelectedTemplateId(null);
      setSelectedPresetTemplateId(null);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      show({ message: '請輸入內容', type: 'error' });
      return;
    }

    // 檢查是否有正在解析的檔案
    const parsingFiles = referenceFiles.filter(f => 
      f.parse_status === 'pending' || f.parse_status === 'parsing'
    );
    if (parsingFiles.length > 0) {
      show({ 
        message: `還有 ${parsingFiles.length} 個參考檔案正在解析中，請等待解析完成`, 
        type: 'info' 
      });
      return;
    }

    try {
      // 如果有範本ID但沒有File，按需載入
      let templateFile = selectedTemplate;
      if (!templateFile && (selectedTemplateId || selectedPresetTemplateId)) {
        const templateId = selectedTemplateId || selectedPresetTemplateId;
        if (templateId) {
          templateFile = await getTemplateFile(templateId, userTemplates);
        }
      }
      
      await initializeProject(activeTab, content, templateFile || undefined);
      
      // 根據類型跳轉到不同頁面
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        show({ message: '專案建立失敗', type: 'error' });
        return;
      }
      
      // 關聯參考檔案到專案
      if (referenceFiles.length > 0) {
        console.log(`Associating ${referenceFiles.length} reference files to project ${projectId}:`, referenceFiles);
        try {
          // 批量更新檔案的 project_id
          const results = await Promise.all(
            referenceFiles.map(async file => {
              const response = await associateFileToProject(file.id, projectId);
              console.log(`Associated file ${file.id}:`, response);
              return response;
            })
          );
          console.log('Reference files associated successfully:', results);
        } catch (error) {
          console.error('Failed to associate reference files:', error);
          // 不影響主流程，繼續執行
        }
      } else {
        console.log('No reference files to associate');
      }
      
      // 關聯圖片素材到專案（解析content中的markdown圖片連結）
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const materialUrls: string[] = [];
      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        materialUrls.push(match[2]); // match[2] 是 URL
      }
      
      if (materialUrls.length > 0) {
        console.log(`Associating ${materialUrls.length} materials to project ${projectId}:`, materialUrls);
        try {
          const response = await associateMaterialsToProject(projectId, materialUrls);
          console.log('Materials associated successfully:', response);
        } catch (error) {
          console.error('Failed to associate materials:', error);
          // 不影響主流程，繼續執行
        }
      } else {
        console.log('No materials to associate');
      }
      
      if (activeTab === 'idea' || activeTab === 'outline') {
        navigate(`/project/${projectId}/outline`);
      } else if (activeTab === 'description') {
        // 從描述生成：直接跳到描述生成頁（因為已經自動生成了大綱和描述）
        navigate(`/project/${projectId}/detail`);
      }
    } catch (error: any) {
      console.error('建立專案失敗:', error);
      // 錯誤已經在 store 中處理並顯示
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 relative overflow-hidden">
      {/* 背景裝飾元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-banana-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl"></div>
      </div>

      {/* 導航列 */}
      <nav className="relative h-16 md:h-18 bg-white/40 backdrop-blur-2xl">

        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="蕉幻 Banana Slides Logo"
                className="h-10 md:h-12 w-auto rounded-lg object-contain"
              />
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-banana-600 via-orange-500 to-pink-500 bg-clip-text text-transparent">
              蕉幻
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {/* 桌面端：帶文字的素材生成按鈕 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleOpenMaterialModal}
              className="hidden sm:inline-flex hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">素材生成</span>
            </Button>
            {/* 手機端：僅圖示的素材生成按鈕 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} />}
              onClick={handleOpenMaterialModal}
              className="sm:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title="素材生成"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/history')}
              className="text-xs md:text-sm hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden sm:inline">歷史專案</span>
              <span className="sm:hidden">歷史</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/settings')}
              className="text-xs md:text-sm hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">設定</span>
              <span className="sm:hidden">設</span>
            </Button>
            <Button variant="ghost" size="sm" className="hidden md:inline-flex hover:bg-banana-50/50">幫助</Button>
          </div>
        </div>
      </nav>

      {/* 主內容 */}
      <main className="relative max-w-5xl mx-auto px-3 md:px-4 py-8 md:py-12">
        {/* Hero 標題區 */}
        <div className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-banana-200/50 shadow-sm mb-4">
            <span className="text-2xl animate-pulse"><Sparkles size={20} color="orange" /></span>
            <span className="text-sm font-medium text-gray-700">基於 nano banana pro🍌 的原生 AI PPT 生成器</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-pink-500 bg-clip-text text-transparent" style={{
              backgroundSize: '200% auto',
              animation: 'gradient 3s ease infinite',
            }}>
              蕉幻 · Banana Slides
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto font-light">
            Vibe your PPT like vibing code
          </p>

          {/* 特性標籤 */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-4">
            {[
              { icon: <Sparkles size={14} className="text-yellow-600" />, label: '一句話生成 PPT' },
              { icon: <FileEdit size={14} className="text-blue-500" />, label: '自然語言修改' },
              { icon: <Search size={14} className="text-orange-500" />, label: '指定區域編輯' },
              
              { icon: <Paperclip size={14} className="text-green-600" />, label: '一鍵導出 PPTX/PDF' },
            ].map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 backdrop-blur-sm rounded-full text-xs md:text-sm text-gray-700 border border-gray-200/50 shadow-sm hover:shadow-md transition-all hover:scale-105 cursor-default"
              >
                {feature.icon}
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        {/* 建立卡片 */}
        <Card className="p-4 md:p-10 bg-white/90 backdrop-blur-xl shadow-2xl border-0 hover:shadow-3xl transition-all duration-300">
          {/* 選項卡 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 md:mb-8">
            {(Object.keys(tabConfig) as CreationType[]).map((type) => {
              const config = tabConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base touch-manipulation ${
                    activeTab === type
                      ? 'bg-gradient-to-r from-banana-500 to-banana-600 text-black shadow-yellow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-banana-50 active:bg-banana-100'
                  }`}
                >
                  <span className="scale-90 md:scale-100">{config.icon}</span>
                  <span className="truncate">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* 描述 */}
          <div className="relative">
            <p className="text-sm md:text-base mb-4 md:mb-6 leading-relaxed">
              <span className="inline-flex items-center gap-2 text-gray-600">
                <Lightbulb size={16} className="text-banana-600 flex-shrink-0" />
                <span className="font-semibold">
                  {tabConfig[activeTab].description}
                </span>
              </span>
            </p>
          </div>

          {/* 輸入區 - 帶按鈕 */}
          <div className="relative mb-2 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-banana-400 to-orange-400 rounded-lg opacity-0 group-hover:opacity-20 blur transition-opacity duration-300"></div>
            <Textarea
              ref={textareaRef}
              placeholder={tabConfig[activeTab].placeholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              rows={activeTab === 'idea' ? 4 : 8}
              className="relative pr-20 md:pr-28 pb-12 md:pb-14 text-sm md:text-base border-2 border-gray-200 focus:border-banana-400 transition-colors duration-200" // 為右下角按鈕留空間
            />

            {/* 左下角：上傳檔案按鈕（迴紋針圖示） */}
            <button
              type="button"
              onClick={handlePaperclipClick}
              className="absolute left-2 md:left-3 bottom-2 md:bottom-3 z-10 p-1.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors active:scale-95 touch-manipulation"
              title="選擇參考檔案"
            >
              <Paperclip size={18} className="md:w-5 md:h-5" />
            </button>

            {/* 右下角：開始生成按鈕 */}
            <div className="absolute right-2 md:right-3 bottom-2 md:bottom-3 z-10">
              <Button
                size="sm"
                onClick={handleSubmit}
                loading={isGlobalLoading}
                disabled={
                  !content.trim() || 
                  referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                }
                className="shadow-sm text-xs md:text-sm px-3 md:px-4"
              >
                {referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                  ? '解析中...'
                  : '下一步'}
              </Button>
            </div>
          </div>

          {/* 隱藏的檔案輸入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 圖片預覽列表 */}
          <ImagePreviewList
            content={content}
            onRemoveImage={handleRemoveImage}
            className="mb-4"
          />

          <ReferenceFileList
            files={referenceFiles}
            onFileClick={setPreviewFileId}
            onFileDelete={handleFileRemove}
            onFileStatusChange={handleFileStatusChange}
            deleteMode="remove"
            className="mb-4"
          />

          {/* 範本選擇 */}
          <div className="mb-6 md:mb-8 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-orange-600 flex-shrink-0" />
                <h3 className="text-base md:text-lg font-semibold text-gray-900">
                  選擇風格範本
                </h3>
              </div>
            </div>
            <TemplateSelector
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplateId}
              selectedPresetTemplateId={selectedPresetTemplateId}
              showUpload={true} // 在主頁上傳的範本儲存到使用者範本庫
              projectId={currentProjectId}
            />
          </div>

        </Card>
      </main>
      <ToastContainer />
      {/* 素材生成模態 - 在主頁始終生成全域素材 */}
      <MaterialGeneratorModal
        projectId={null}
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
      />
      {/* 參考檔案選擇器 */}
      {/* 在 Home 頁面，始終查詢全域檔案，因為此時還沒有專案 */}
      <ReferenceFileSelector
        projectId={null}
        isOpen={isFileSelectorOpen}
        onClose={() => setIsFileSelectorOpen(false)}
        onSelect={handleFilesSelected}
        multiple={true}
        initialSelectedIds={selectedFileIds}
      />
      
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
};
