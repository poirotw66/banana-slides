import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Key, Image, Zap, Save, RotateCcw, Globe, FileText } from 'lucide-react';
import { Button, Input, Card, Loading, useToast, useConfirm } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { OutputLanguage } from '@/api/endpoints';
import { OUTPUT_LANGUAGE_OPTIONS } from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';

// 配置項類型定義
type FieldType = 'text' | 'password' | 'number' | 'select' | 'buttons';

interface FieldConfig {
  key: keyof typeof initialFormData;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  sensitiveField?: boolean;  // 是否為敏感欄位（如 API Key）
  lengthKey?: keyof SettingsType;  // 用於顯示已有長度的 key（如 api_key_length）
  options?: { value: string; label: string }[];  // select 類型的選項
  min?: number;
  max?: number;
}

interface SectionConfig {
  title: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

// 初始表單資料
const initialFormData = {
  ai_provider_format: 'gemini' as 'openai' | 'gemini',
  api_base_url: '',
  api_key: '',
  text_model: '',
  image_model: '',
  image_caption_model: '',
  mineru_api_base: '',
  mineru_token: '',
  image_resolution: '2K',
  image_aspect_ratio: '16:9',
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh' as OutputLanguage,
};

// 配置驅動的表單區塊定義
const settingsSections: SectionConfig[] = [
  {
    title: '大模型 API 配置',
    icon: <Key size={20} />,
    fields: [
      {
        key: 'ai_provider_format',
        label: 'AI 提供商格式',
        type: 'buttons',
        description: '選擇 API 請求格式，影響後端如何構造和發送請求。儲存設定後生效。',
        options: [
          { value: 'openai', label: 'OpenAI 格式' },
          { value: 'gemini', label: 'Gemini 格式' },
        ],
      },
      {
        key: 'api_base_url',
        label: 'API Base URL',
        type: 'text',
        placeholder: 'https://api.example.com',
        description: '設定大模型提供商 API 的基礎 URL',
      },
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: '輸入新的 API Key',
        sensitiveField: true,
        lengthKey: 'api_key_length',
        description: '留空則保持目前設定不變，輸入新值則更新',
      },
    ],
  },
  {
    title: '模型配置',
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'text_model',
        label: '文本大模型',
        type: 'text',
        placeholder: '留空使用環境變數配置 (如: gemini-2.0-flash-exp)',
        description: '用於生成大綱、描述等文字內容的模型名稱',
      },
      {
        key: 'image_model',
        label: '圖像生成模型',
        type: 'text',
        placeholder: '留空使用環境變數配置 (如: imagen-3.0-generate-001)',
        description: '用於生成頁面圖片的模型名稱',
      },
      {
        key: 'image_caption_model',
        label: '圖片辨識模型',
        type: 'text',
        placeholder: '留空使用環境變數配置 (如: gemini-2.0-flash-exp)',
        description: '用於識別參考檔案中的圖片並生成描述',
      },
    ],
  },
  {
    title: 'MinerU 配置',
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'mineru_api_base',
        label: 'MinerU API Base',
        type: 'text',
        placeholder: '留空使用環境變數配置 (如: https://mineru.net)',
        description: 'MinerU 服務位址，用於解析參考檔案',
      },
      {
        key: 'mineru_token',
        label: 'MinerU Token',
        type: 'password',
        placeholder: '輸入新的 MinerU Token',
        sensitiveField: true,
        lengthKey: 'mineru_token_length',
        description: '留空則保持目前設定不變，輸入新值則更新',
      },
    ],
  },
  {
    title: '圖像生成配置',
    icon: <Image size={20} />,
    fields: [
      {
        key: 'image_resolution',
        label: '圖像清晰度（某些OpenAI格式中轉調整該值無效）',
        type: 'select',
        description: '更高的清晰度會生成更詳細的圖像，但需要更長時間',
        options: [
          { value: '1K', label: '1K (1024px)' },
          { value: '2K', label: '2K (2048px)' },
          { value: '4K', label: '4K (4096px)' },
        ],
      },
    ],
  },
  {
    title: '性能配置',
    icon: <Zap size={20} />,
    fields: [
      {
        key: 'max_description_workers',
        label: '描述生成最大並發數',
        type: 'number',
        min: 1,
        max: 20,
        description: '同時生成描述的最大工作線程數 (1-20)，越大速度越快',
      },
      {
        key: 'max_image_workers',
        label: '圖像生成最大並發數',
        type: 'number',
        min: 1,
        max: 20,
        description: '同時生成圖像的最大工作線程數 (1-20)，越大速度越快',
      },
    ],
  },
  {
    title: '輸出語言設定',
    icon: <Globe size={20} />,
    fields: [
      {
        key: 'output_language',
        label: '預設輸出語言',
        type: 'buttons',
        description: 'AI 生成內容時使用的預設語言',
        options: OUTPUT_LANGUAGE_OPTIONS,
      },
    ],
  },
];

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData({
          ai_provider_format: response.data.ai_provider_format || 'gemini',
          api_base_url: response.data.api_base_url || '',
          api_key: '',
          image_resolution: response.data.image_resolution || '2K',
          image_aspect_ratio: response.data.image_aspect_ratio || '16:9',
          max_description_workers: response.data.max_description_workers || 5,
          max_image_workers: response.data.max_image_workers || 8,
          text_model: response.data.text_model || '',
          image_model: response.data.image_model || '',
          mineru_api_base: response.data.mineru_api_base || '',
          mineru_token: '',
          image_caption_model: response.data.image_caption_model || '',
          output_language: response.data.output_language || 'zh',
        });
      }
    } catch (error: any) {
      console.error('載入設定失敗:', error);
      show({
        message: '載入設定失敗: ' + (error?.message || '未知錯誤'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { api_key, mineru_token, ...otherData } = formData;
      const payload: Parameters<typeof api.updateSettings>[0] = {
        ...otherData,
      };

      if (api_key) {
        payload.api_key = api_key;
      }

      if (mineru_token) {
        payload.mineru_token = mineru_token;
      }

      const response = await api.updateSettings(payload);
      if (response.data) {
        setSettings(response.data);
        show({ message: '設定儲存成功', type: 'success' });
        setFormData(prev => ({ ...prev, api_key: '', mineru_token: '' }));
      }
    } catch (error: any) {
      console.error('儲存設定失敗:', error);
      show({
        message: '儲存設定失敗: ' + (error?.response?.data?.error?.message || error?.message || '未知錯誤'),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    confirm(
      '將把大模型、圖像生成和並發等所有設定恢復為環境預設值，已儲存的自定義設定將丟失，確定繼續嗎？',
      async () => {
        setIsSaving(true);
        try {
          const response = await api.resetSettings();
          if (response.data) {
            setSettings(response.data);
            setFormData({
              ai_provider_format: response.data.ai_provider_format || 'gemini',
              api_base_url: response.data.api_base_url || '',
              api_key: '',
              image_resolution: response.data.image_resolution || '2K',
              image_aspect_ratio: response.data.image_aspect_ratio || '16:9',
              max_description_workers: response.data.max_description_workers || 5,
              max_image_workers: response.data.max_image_workers || 8,
              text_model: response.data.text_model || '',
              image_model: response.data.image_model || '',
              mineru_api_base: response.data.mineru_api_base || '',
              mineru_token: '',
              image_caption_model: response.data.image_caption_model || '',
              output_language: response.data.output_language || 'zh',
            });
            show({ message: '設定已重置', type: 'success' });
          }
        } catch (error: any) {
          console.error('重置設定失敗:', error);
          show({
            message: '重置設定失敗: ' + (error?.message || '未知錯誤'),
            type: 'error'
          });
        } finally {
          setIsSaving(false);
        }
      },
      {
        title: '確認重置為預設設定',
        confirmText: '確定重置',
        cancelText: '取消',
        variant: 'warning',
      }
    );
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key];

    if (field.type === 'buttons' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFieldChange(field.key, option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  value === option.value
                    ? option.value === 'openai'
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                      : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {field.description && (
            <p className="mt-1 text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    // text, password, number 类型
    const placeholder = field.sensitiveField && settings && field.lengthKey
      ? `已設定（長度: ${settings[field.lengthKey]}）`
      : field.placeholder || '';

    return (
      <div key={field.key}>
        <Input
          label={field.label}
          type={field.type === 'number' ? 'number' : field.type}
          placeholder={placeholder}
          value={value as string | number}
          onChange={(e) => {
            const newValue = field.type === 'number' 
              ? parseInt(e.target.value) || (field.min ?? 0)
              : e.target.value;
            handleFieldChange(field.key, newValue);
          }}
          min={field.min}
          max={field.max}
        />
        {field.description && (
          <p className="mt-1 text-sm text-gray-500">{field.description}</p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-banana-50 to-yellow-50 flex items-center justify-center">
        <Loading text="載入設定中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 to-yellow-50">
      <ToastContainer />
      {ConfirmDialog}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            {/* 頂部標題 */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  icon={<Home size={18} />}
                  onClick={() => navigate('/')}
                  className="mr-4"
                >
                  返回首頁
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">系統設定</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    配置應用的各項參數
                  </p>
                </div>
              </div>
            </div>

            {/* 配置區塊（配置驅動） */}
            <div className="space-y-8">
              {settingsSections.map((section) => (
                <div key={section.title}>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    {section.icon}
                    <span className="ml-2">{section.title}</span>
                  </h2>
                  <div className="space-y-4">
                    {section.fields.map((field) => renderField(field))}
                  </div>
                </div>
              ))}
            </div>

            {/* 操作按鈕 */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                icon={<RotateCcw size={18} />}
                onClick={handleReset}
                disabled={isSaving}
              >
                重置為預設配置
              </Button>
              <Button
                variant="primary"
                icon={<Save size={18} />}
                onClick={handleSave}
                loading={isSaving}
              >
                {isSaving ? '儲存中...' : '儲存設定'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
