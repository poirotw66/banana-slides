import { getImageUrl } from '@/api/client';
import type { Project } from '@/types';

/**
 * 獲取專案標題
 */
export const getProjectTitle = (project: Project): string => {
  // 如果有 idea_prompt，优先使用
  if (project.idea_prompt) {
    return project.idea_prompt;
  }
  
  // 如果沒有 idea_prompt，嘗試從第一個頁面獲取標題
  if (project.pages && project.pages.length > 0) {
    // 按 order_index 排序，找到第一個頁面
    const sortedPages = [...project.pages].sort((a, b) => 
      (a.order_index || 0) - (b.order_index || 0)
    );
    const firstPage = sortedPages[0];
    
    // 如果第一個頁面有 outline_content 和 title，使用它
    if (firstPage?.outline_content?.title) {
      return firstPage.outline_content.title;
    }
  }
  
  // 預設返回未命名專案
  return '未命名專案';
};

/**
 * 獲取第一頁圖片URL
 */
export const getFirstPageImage = (project: Project): string | null => {
  if (!project.pages || project.pages.length === 0) {
    return null;
  }
  
  // 找到第一頁有圖片的頁面
  const firstPageWithImage = project.pages.find(p => p.generated_image_path);
  if (firstPageWithImage?.generated_image_path) {
    return getImageUrl(firstPageWithImage.generated_image_path, firstPageWithImage.updated_at);
  }
  
  return null;
};

/**
 * 格式化日期
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 獲取專案狀態文字
 */
export const getStatusText = (project: Project): string => {
  if (!project.pages || project.pages.length === 0) {
    return '未開始';
  }
  const hasImages = project.pages.some(p => p.generated_image_path);
  if (hasImages) {
    return '已完成';
  }
  const hasDescriptions = project.pages.some(p => p.description_content);
  if (hasDescriptions) {
    return '待生成圖片';
  }
  return '待生成描述';
};

/**
 * 獲取專案狀態顏色樣式
 */
export const getStatusColor = (project: Project): string => {
  const status = getStatusText(project);
  if (status === '已完成') return 'text-green-600 bg-green-50';
  if (status === '待生成圖片') return 'text-yellow-600 bg-yellow-50';
  if (status === '待生成描述') return 'text-blue-600 bg-blue-50';
  return 'text-gray-600 bg-gray-50';
};

/**
 * 獲取專案路由路徑
 */
export const getProjectRoute = (project: Project): string => {
  const projectId = project.id || project.project_id;
  if (!projectId) return '/';
  
  if (project.pages && project.pages.length > 0) {
    const hasImages = project.pages.some(p => p.generated_image_path);
    if (hasImages) {
      return `/project/${projectId}/preview`;
    }
    const hasDescriptions = project.pages.some(p => p.description_content);
    if (hasDescriptions) {
      return `/project/${projectId}/detail`;
    }
    return `/project/${projectId}/outline`;
  }
  return `/project/${projectId}/outline`;
};

