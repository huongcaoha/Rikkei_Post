import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Tag, Avatar, Spin, Tooltip } from 'antd';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  RotateCcw,
  Package,
  MapPin,
  DollarSign,
  Wallet,
} from 'lucide-react';
import { aiApi } from '../../api/ai';
import { useAuth } from '../../context/AuthContext';
import { AiChatMessage } from '../../types';

export const AiChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      content:
        '👋 **Xin chào! Em là Trợ lý AI Thông minh của Rikkei_Post.**\n\nEm có thể hỗ trợ bạn:\n- 📦 **Tra cứu đơn hàng:** Cung cấp mã vận đơn để kiểm tra vị trí & bưu tá.\n- 💰 **Biểu phí vận chuyển:** Ước tính cước nội tỉnh & liên tỉnh.\n- 🏢 **Tìm bưu cục:** Địa chỉ và hotline bưu cục gần nhất.\n- 💵 **Đối soát COD:** Kiểm tra số dư ví shop & tiến độ quyết toán.\n\nBạn cần em giải đáp thông tin gì ạ?',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Tra cứu đơn hàng',
        'Bảng giá cước vận chuyển',
        'Tìm bưu cục gần nhất',
        'Chính sách đối soát COD',
      ],
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: AiChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const res = await aiApi.chat(text, history);
      const data = res.data.data;

      const aiMsg: AiChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        detectedIntent: data.detectedIntent,
        suggestions: data.suggestions,
        structuredData: data.structuredData,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: AiChatMessage = {
        id: 'ai-err-' + Date.now(),
        sender: 'ai',
        content: 'Rất tiếc, đã có lỗi kết nối tới trợ lý AI. Vui lòng thử lại sau giây lát!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'ai',
        content: 'Cuộc trò chuyện đã được làm mới. Em sẵn sàng hỗ trợ bạn!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'Tra cứu đơn hàng',
          'Bảng giá cước vận chuyển',
          'Tìm bưu cục gần nhất',
        ],
      },
    ]);
  };

  // Simple Markdown renderer for tables, lists, bold text
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-gray-900 mt-2 mb-1 text-sm">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <div key={idx} className="flex items-start gap-1.5 ml-1">
                <span className="text-red-500 font-bold">•</span>
                <span>{renderInlineStyles(line.replace('- ', ''))}</span>
              </div>
            );
          }
          if (line.startsWith('|')) {
            return (
              <div key={idx} className="font-mono text-2xs bg-gray-100 p-0.5 rounded overflow-x-auto">
                {line}
              </div>
            );
          }
          return <p key={idx} className="my-0.5">{renderInlineStyles(line)}</p>;
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 group"
          title="Mở Trợ lý AI Rikkei_Post"
        >
          <div className="relative">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <span className="font-semibold text-sm tracking-wide">Trợ lý AI CSKH</span>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] sm:w-[420px] h-[580px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Bot size={22} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">
                  Rikkei Post Assistant
                  <Tag color="success" className="text-2xs m-0 px-1 py-0 leading-tight">
                    AI Online
                  </Tag>
                </div>
                <div className="text-2xs text-red-100">Hỗ trợ tra cứu & CSKH 24/7</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip title="Làm mới cuộc trò chuyện">
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 text-red-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
              </Tooltip>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-red-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/70">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={14} />
                  </div>
                )}

                <div className="max-w-[85%] space-y-2">
                  <div
                    className={`p-3 rounded-2xl shadow-xs text-xs sm:text-sm ${
                      msg.sender === 'user'
                        ? 'bg-red-600 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                    }`}
                  >
                    {renderFormattedContent(msg.content)}
                    <div
                      className={`text-3xs text-right mt-1 ${
                        msg.sender === 'user' ? 'text-red-200' : 'text-gray-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Suggestion Chips */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(sug)}
                          className="text-2xs bg-white hover:bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full shadow-xs transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-gray-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon size={14} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400 italic pl-9">
                <Spin size="small" /> Trợ lý AI đang tra cứu dữ liệu...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Bar */}
          <div className="px-3 py-1.5 bg-gray-100 border-t border-gray-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSend('Tra cứu đơn hàng')}
              className="text-2xs bg-white hover:bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600 shrink-0 flex items-center gap-1"
            >
              <Package size={11} className="text-red-600" /> Tra đơn
            </button>
            <button
              onClick={() => handleSend('Bảng giá cước vận chuyển')}
              className="text-2xs bg-white hover:bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600 shrink-0 flex items-center gap-1"
            >
              <DollarSign size={11} className="text-green-600" /> Bảng giá
            </button>
            <button
              onClick={() => handleSend('Tìm bưu cục gần nhất')}
              className="text-2xs bg-white hover:bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600 shrink-0 flex items-center gap-1"
            >
              <MapPin size={11} className="text-blue-600" /> Bưu cục
            </button>
            <button
              onClick={() => handleSend('Số dư ví COD của tôi')}
              className="text-2xs bg-white hover:bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600 shrink-0 flex items-center gap-1"
            >
              <Wallet size={11} className="text-purple-600" /> Ví COD
            </button>
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onPressEnter={() => handleSend()}
              placeholder="Nhập câu hỏi hoặc mã vận đơn..."
              disabled={loading}
              className="rounded-full text-xs sm:text-sm py-1.5"
            />
            <Button
              type="primary"
              shape="circle"
              icon={<Send size={15} />}
              onClick={() => handleSend()}
              loading={loading}
              className="bg-red-600 hover:bg-red-700 shrink-0"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
