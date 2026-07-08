# 滑块验证码背景图

此目录用于存放图形滑块验证码的背景图片。

## 使用说明

1. **图片格式**：支持 `.jpg` / `.jpeg` / `.png` / `.webp`
2. **图片尺寸**：建议 800×600 以上，系统会自动裁剪为 350×200
3. **图片内容**：风景、纹理、抽象图案均可，避免纯色或过于简单的图片
4. **数量**：建议放 10-20 张，系统会随机选择

## 示例图片来源

可以从以下免费图库下载：
- Unsplash: https://unsplash.com/
- Pexels: https://www.pexels.com/
- Pixabay: https://pixabay.com/

搜索关键词：landscape / texture / abstract / nature / gradient

## 如果没有图片

如果此目录为空，系统会自动生成随机渐变色背景（降级方案）。

## 示例

```bash
# 下载示例背景图（可选）
cd assets/captcha-backgrounds
wget https://images.unsplash.com/photo-1506905925346-21bda4d32df4 -O bg1.jpg
wget https://images.unsplash.com/photo-1518837695005-2083093ee35b -O bg2.jpg
wget https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5 -O bg3.jpg
```

或手动放入任意风景照片即可。
