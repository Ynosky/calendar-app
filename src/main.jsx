import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Tag, BookOpen, Copy, Mail, Search } from 'lucide-react';

const CalendarApp = () => {
  // 日本時間でのDate作成関数
  const createJapanDate = (year, month, day, hour = 0, minute = 0) => {
    return new Date(year, month, day, hour, minute);
  };

  // 現在の日本時間
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [view, setView] = useState('month'); // 'month' or 'week'
  const [showEventModal, setShowEventModal] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'journal'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchTag, setSearchTag] = useState('');
  const [showFreeTime, setShowFreeTime] = useState(true); // 空き時間の表示切り替え
  const [selectedNode, setSelectedNode] = useState(null); // 選択されたノード
  
  // イベントカラー
  const eventColors = [
    { name: 'ブルー', value: 'bg-blue-500', border: 'border-blue-500' },
    { name: 'グリーン', value: 'bg-green-500', border: 'border-green-500' },
    { name: 'レッド', value: 'bg-red-500', border: 'border-red-500' },
    { name: 'パープル', value: 'bg-purple-500', border: 'border-purple-500' },
    { name: 'オレンジ', value: 'bg-orange-500', border: 'border-orange-500' },
    { name: 'ピンク', value: 'bg-pink-500', border: 'border-pink-500' },
    { name: 'イエロー', value: 'bg-yellow-500', border: 'border-yellow-500' },
    { name: 'インディゴ', value: 'bg-indigo-500', border: 'border-indigo-500' }
  ];

  // サンプルデータ
  const [events, setEvents] = useState([
    {
      id: 1,
      title: 'チームミーティング',
      start: createJapanDate(2025, 5, 28, 10, 0), // 6月28日 10:00
      end: createJapanDate(2025, 5, 28, 11, 30),   // 6月28日 11:30
      color: eventColors[0],
      tags: ['会議', 'チーム', '企画'],
      notes: 'Q3の目標設定について議論。新プロジェクトの進捗確認も行った。'
    },
    {
      id: 2,
      title: 'クライアント打ち合わせ',
      start: createJapanDate(2025, 5, 28, 14, 0), // 6月28日 14:00
      end: createJapanDate(2025, 5, 28, 15, 30),   // 6月28日 15:30
      color: eventColors[2],
      tags: ['クライアント', '営業', '重要'],
      notes: 'ABC株式会社との新規案件について。要件定義の詳細を確認。次回までに提案書を準備する。'
    },
    {
      id: 3,
      title: 'プレゼン準備',
      start: createJapanDate(2025, 5, 29, 9, 0),  // 6月29日 09:00
      end: createJapanDate(2025, 5, 29, 12, 0),    // 6月29日 12:00
      color: eventColors[4],
      tags: ['プレゼン', '準備', '重要'],
      notes: '来週の役員プレゼンの資料作成。データ分析結果をグラフ化し、提案内容を整理。'
    }
  ]);

  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    color: eventColors[0],
    tags: '',
    notes: ''
  });

  // 時間スロット（1時間間隔）
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    return `${i.toString().padStart(2, '0')}:00`;
  });

  // 曜日の配列
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 月の最初の日を取得
  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  // 月の日数を取得
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // 週の開始日を取得（月曜日スタート）
  const getWeekStart = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.getFullYear(), date.getMonth(), diff);
  };

  // 日付フォーマット関数
  const formatDate = (date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const formatTime = (date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateTimeString = (date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return `${month}月${day}日（${dayOfWeek}）`;
  };

  // 特定の日のイベントを取得
  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getFullYear() === date.getFullYear() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getDate() === date.getDate();
    });
  };

  // 特定の時間に重なるイベントを取得
  const getEventsForTimeSlot = (date, timeSlot) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    const slotTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0);
    const slotEndTime = new Date(slotTime.getTime() + 60 * 60 * 1000); // 1時間後
    
    return events.filter(event => {
      return event.start < slotEndTime && event.end > slotTime;
    });
  };

  // 連続する空き時間ブロックを取得（実際の空き時間そのまま）
  const getFreeTimeBlocks = (date) => {
    const freeBlocks = [];
    const dayEvents = getEventsForDate(date).sort((a, b) => a.start - b.start);
    
    // 一日の開始と終了
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0);
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 24, 0);
    
    let currentTime = dayStart;
    
    for (const event of dayEvents) {
      // 現在時刻とイベント開始時刻の間に空きがあるか
      if (currentTime < event.start) {
        const freeStart = new Date(currentTime);
        const freeEnd = new Date(event.start);
        
        // 1時間以上の空き時間のみ表示
        if ((freeEnd - freeStart) >= 60 * 60 * 1000) {
          freeBlocks.push({
            start: freeStart,
            end: freeEnd
          });
        }
      }
      
      // 現在時刻をイベント終了時刻に更新
      currentTime = event.end > currentTime ? event.end : currentTime;
    }
    
    // 最後のイベント後に空きがあるか
    if (currentTime < dayEnd) {
      const freeStart = new Date(currentTime);
      const freeEnd = dayEnd;
      
      // 1時間以上の空き時間のみ表示
      if ((freeEnd - freeStart) >= 60 * 60 * 1000) {
        freeBlocks.push({
          start: freeStart,
          end: freeEnd
        });
      }
    }
    
    return freeBlocks;
  };

  // ツェッテルカステン: 関連度計算
  const calculateRelatedness = (event1, event2) => {
    let score = 0;
    
    // タグの共通性 (40%)
    const commonTags = event1.tags.filter(tag => event2.tags.includes(tag));
    const tagScore = commonTags.length / Math.max(event1.tags.length, event2.tags.length, 1);
    score += tagScore * 0.4;
    
    // 内容の類似性 (30%)
    const words1 = (event1.title + ' ' + (event1.notes || '')).toLowerCase().split(/\s+/);
    const words2 = (event2.title + ' ' + (event2.notes || '')).toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 2);
    const contentScore = commonWords.length / Math.max(words1.length, words2.length, 1);
    score += contentScore * 0.3;
    
    // 時間的近接性 (20%)
    const timeDiff = Math.abs(event1.start - event2.start) / (1000 * 60 * 60 * 24); // 日数
    const timeScore = Math.max(0, 1 - timeDiff / 30); // 30日以内で最大スコア
    score += timeScore * 0.2;
    
    // カテゴリの類似性 (10%)
    const categoryScore = event1.color.value === event2.color.value ? 1 : 0;
    score += categoryScore * 0.1;
    
    return score;
  };

  // ニューロンネットワーク: ノード間の接続を取得
  const getNodeConnections = (targetEvent) => {
    return events
      .filter(event => event.id !== targetEvent.id)
      .map(event => ({
        event,
        strength: calculateRelatedness(targetEvent, event)
      }))
      .filter(connection => connection.strength > 0.2)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10); // 上位10個の接続
  };

  // インサイト生成
  const generateInsights = (event) => {
    const connections = getNodeConnections(event);
    const insights = [];
    
    // パターン分析
    const strongConnections = connections.filter(c => c.strength > 0.5);
    if (strongConnections.length > 2) {
      insights.push(`強い関連性を持つイベントが${strongConnections.length}個あります。パターンが形成されています。`);
    }
    
    // タグクラスター分析
    const allRelatedTags = connections.flatMap(c => c.event.tags);
    const tagCounts = {};
    allRelatedTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const frequentTags = Object.entries(tagCounts)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    
    if (frequentTags.length > 0) {
      insights.push(`頻出タグ: ${frequentTags.slice(0, 3).map(([tag]) => tag).join(', ')}`);
    }
    
    // 時系列パターン
    const recentConnections = connections.filter(c => 
      Math.abs(c.event.start - event.start) < 7 * 24 * 60 * 60 * 1000
    );
    if (recentConnections.length > 0) {
      insights.push(`同時期に関連するイベントが${recentConnections.length}個あります。`);
    }
    
    return insights;
  };

  // イベント追加/編集
  const handleEventSubmit = () => {
    if (!eventForm.title || !eventForm.date || !eventForm.startTime || !eventForm.endTime) {
      alert('必要な項目を入力してください');
      return;
    }

    const [year, month, day] = eventForm.date.split('-').map(Number);
    const [startHour, startMinute] = eventForm.startTime.split(':').map(Number);
    const [endHour, endMinute] = eventForm.endTime.split(':').map(Number);

    const newEvent = {
      id: editingEvent ? editingEvent.id : Date.now(),
      title: eventForm.title,
      start: createJapanDate(year, month - 1, day, startHour, startMinute),
      end: createJapanDate(year, month - 1, day, endHour, endMinute),
      color: eventForm.color,
      tags: eventForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      notes: eventForm.notes
    };

    if (editingEvent) {
      setEvents(events.map(event => event.id === editingEvent.id ? newEvent : event));
    } else {
      setEvents([...events, newEvent]);
    }

    setShowEventModal(false);
    setEditingEvent(null);
    setEventForm({
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      color: eventColors[0],
      tags: '',
      notes: ''
    });
  };

  // イベント削除
  const handleDeleteEvent = (eventId) => {
    setEvents(events.filter(event => event.id !== eventId));
    setShowEventModal(false);
    setEditingEvent(null);
  };

  // イベント編集開始
  const startEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      date: formatDate(event.start),
      startTime: formatTime(event.start),
      endTime: formatTime(event.end),
      color: event.color,
      tags: event.tags.join(', '),
      notes: event.notes || ''
    });
    setShowEventModal(true);
  };

  // 日付クリック（月表示）
  const handleDateClick = (date) => {
    setSelectedDate(date);
    setEventForm({
      ...eventForm,
      date: formatDate(date),
      startTime: '09:00',
      endTime: '10:00'
    });
    setShowEventModal(true);
  };

  // 時間スロットクリック（週表示）
  const handleTimeSlotClick = (date, timeSlot) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    const endHour = hour + 1;
    
    setSelectedDate(date);
    setSelectedTime(timeSlot);
    setEventForm({
      ...eventForm,
      date: formatDate(date),
      startTime: timeSlot,
      endTime: `${endHour.toString().padStart(2, '0')}:00`
    });
    setShowEventModal(true);
  };

  // 空き時間ブロッククリック（クリップボードにコピー）
  const handleFreeTimeBlockClick = (date, startTime, endTime) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    const startTimeStr = formatTime(startTime);
    const endTimeStr = formatTime(endTime);
    
    const copyText = `${month}月${day}日（${dayOfWeek}）${startTimeStr}〜${endTimeStr}`;
    
    navigator.clipboard.writeText(copyText).then(() => {
      alert(`クリップボードにコピーしました: ${copyText}`);
    });
  };

  // タグベースでのメール送信
  const handleTagEmail = (tag) => {
    const relatedEvents = events.filter(event => event.tags.includes(tag));
    const emailBody = relatedEvents.map(event => {
      const dateStr = formatDateTimeString(event.start);
      const timeStr = `${formatTime(event.start)}~${formatTime(event.end)}`;
      return `${event.title} - ${dateStr} ${timeStr}\n${event.notes || ''}\n`;
    }).join('\n');
    
    const subject = `タグ「${tag}」に関連するイベント情報`;
    const mailto = `mailto:317ryuryu@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailto);
  };

  // 関連イベントを取得（同じタグを持つ過去のイベント）
  const getRelatedEvents = (tags) => {
    return events.filter(event => 
      event.tags.some(tag => tags.includes(tag)) && event.start < new Date()
    ).sort((a, b) => b.start - a.start);
  };

  // 月表示カレンダーのレンダリング
  const renderMonthView = () => {
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const calendarDays = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      calendarDays.push(date);
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center font-semibold bg-gray-100">
            {day}
          </div>
        ))}
        {calendarDays.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const isToday = date.toDateString() === today.toDateString();
          const dayEvents = getEventsForDate(date);

          return (
            <div
              key={index}
              className={`min-h-24 p-1 border cursor-pointer hover:bg-gray-50 ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-100'
              } ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
              onClick={() => handleDateClick(date)}
            >
              <div className={`text-sm mb-1 ${isToday ? 'font-bold text-blue-600' : ''}`}>
                {date.getDate()}
              </div>
              {dayEvents.slice(0, 3).map(event => (
                <div
                  key={event.id}
                  className={`text-xs p-1 mb-1 rounded text-white truncate ${event.color.value}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditEvent(event);
                  }}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-500">+{dayEvents.length - 3}件</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 週表示カレンダーのレンダリング
  const renderWeekView = () => {
    const weekStart = getWeekStart(currentDate);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });

    return (
      <div className="flex">
        {/* 時間軸 */}
        <div className="w-16 flex-shrink-0">
          <div className="h-14 border-b border-gray-200"></div>
          {timeSlots.map(time => (
            <div key={time} className="h-8 border-b border-gray-100 text-xs text-gray-500 pr-2 text-right pt-1">
              {time}
            </div>
          ))}
        </div>

        {/* 日付列 */}
        {weekDates.map((date, dayIndex) => {
          const isToday = date.toDateString() === today.toDateString();
          const dayEvents = getEventsForDate(date);

          return (
            <div key={dayIndex} className="flex-1 border-r border-gray-200">
              {/* 日付ヘッダー */}
              <div className={`h-14 border-b border-gray-200 p-2 text-center ${
                isToday ? 'bg-blue-50 text-blue-600 font-bold' : ''
              }`}>
                <div className="text-sm">{weekDays[date.getDay()]}</div>
                <div className="text-lg">{date.getDate()}</div>
              </div>

              {/* 時間スロット */}
              <div className="relative">
                {showFreeTime && (
                  /* 空き時間ブロック */
                  getFreeTimeBlocks(date).map((block, blockIndex) => {
                    const startHour = block.start.getHours() + (block.start.getMinutes() / 60);
                    const endHour = block.end.getHours() + (block.end.getMinutes() / 60);
                    const topPosition = startHour * 32; // 32px per hour
                    const height = (endHour - startHour) * 32;
                    
                    return (
                      <div
                        key={`free-${blockIndex}`}
                        className="absolute left-1 right-1 bg-green-100 border border-green-200 text-green-700 text-xs p-1 rounded cursor-pointer hover:bg-green-200 z-5"
                        style={{ 
                          top: `${topPosition}px`, 
                          height: `${height}px` 
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFreeTimeBlockClick(date, block.start, block.end);
                        }}
                        title="クリックしてコピー"
                      >
                        <div className="font-medium text-xs">空き時間</div>
                        <div className="text-xs">
                          {formatTime(block.start)}-{formatTime(block.end)}
                        </div>
                      </div>
                    );
                  })
                )}
                
                {timeSlots.map((timeSlot, timeIndex) => {
                  const slotEvents = getEventsForTimeSlot(date, timeSlot);
                  
                  return (
                    <div
                      key={timeIndex}
                      className="h-8 border-b border-gray-100 hover:bg-gray-50 cursor-pointer relative"
                      onClick={() => handleTimeSlotClick(date, timeSlot)}
                    >
                      {/* 時間スロット内のイベント */}
                      {slotEvents.map(event => {
                        const eventStart = new Date(event.start);
                        const eventEnd = new Date(event.end);
                        const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                          parseInt(timeSlot.split(':')[0]), 0);
                        
                        // イベントがこのスロットで開始する場合のみ表示
                        if (eventStart.getTime() === slotStart.getTime()) {
                          const duration = (eventEnd - eventStart) / (1000 * 60); // 分単位
                          const height = (duration / 60) * 32; // 60分 = 32px
                          
                          return (
                            <div
                              key={event.id}
                              className={`absolute left-1 right-1 ${event.color.value} text-white text-xs p-1 rounded cursor-pointer z-10`}
                              style={{ height: `${height}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditEvent(event);
                              }}
                            >
                              <div className="font-semibold truncate">{event.title}</div>
                              <div className="truncate">{formatTime(eventStart)}-{formatTime(eventEnd)}</div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // イベントモーダルのレンダリング
  const renderEventModal = () => {
    if (!showEventModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            {editingEvent ? 'イベント編集' : 'イベント追加'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">タイトル</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={eventForm.title}
                onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">日付</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={eventForm.date}
                onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">開始時間</label>
                <input
                  type="time"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">終了時間</label>
                <input
                  type="time"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">カラー</label>
              <div className="grid grid-cols-4 gap-2">
                {eventColors.map((color, index) => (
                  <button
                    key={index}
                    className={`w-8 h-8 rounded border-2 ${color.value} ${
                      eventForm.color.value === color.value ? 'ring-2 ring-gray-400' : ''
                    }`}
                    onClick={() => setEventForm({...eventForm, color: color})}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">タグ（カンマ区切り）</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={eventForm.tags}
                onChange={(e) => setEventForm({...eventForm, tags: e.target.value})}
                placeholder="会議, プロジェクト, 重要"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">メモ</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 h-20"
                value={eventForm.notes}
                onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
              />
            </div>
          </div>
          
          <div className="flex justify-between mt-6">
            <div>
              {editingEvent && (
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                >
                  削除
                </button>
              )}
            </div>
            <div className="space-x-2">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                onClick={() => {
                  setShowEventModal(false);
                  setEditingEvent(null);
                }}
              >
                キャンセル
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={handleEventSubmit}
              >
                {editingEvent ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ツェッテルカステン風日記ビューのレンダリング
  const renderJournalView = () => {
    const allTags = [...new Set(events.flatMap(event => event.tags))];
    const filteredEvents = searchTag 
      ? events.filter(event => 
          event.tags.some(tag => tag.toLowerCase().includes(searchTag.toLowerCase())) ||
          event.title.toLowerCase().includes(searchTag.toLowerCase()) ||
          (event.notes && event.notes.toLowerCase().includes(searchTag.toLowerCase()))
        )
      : events;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">ツェッテルカステン - 知識ネットワーク</h3>
          <div className="text-sm text-gray-500">
            {events.length}個のイベント・ノード
          </div>
        </div>
        
        {/* 検索・フィルター */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4" />
            <input
              type="text"
              className="border border-gray-300 rounded px-3 py-2 flex-1"
              placeholder="タグ、タイトル、内容で検索..."
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
            />
            {searchTag && (
              <button
                className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => setSearchTag('')}
              >
                クリア
              </button>
            )}
          </div>
          
          {/* タグクラウド */}
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => {
              const tagEvents = events.filter(e => e.tags.includes(tag));
              const intensity = Math.min(tagEvents.length / 3, 1);
              return (
                <button
                  key={tag}
                  className={`text-sm px-3 py-1 rounded-full transition-all duration-200 ${
                    searchTag === tag 
                      ? 'bg-blue-500 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  style={{ 
                    opacity: 0.6 + (intensity * 0.4),
                    fontSize: `${0.875 + (intensity * 0.125)}rem`
                  }}
                  onClick={() => setSearchTag(searchTag === tag ? '' : tag)}
                >
                  {tag} <span className="text-xs">({tagEvents.length})</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* ニューラルネットワーク表示 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* メインノード */}
          <div className="lg:col-span-2 space-y-4 max-h-96 overflow-y-auto">
            {filteredEvents.sort((a, b) => b.start - a.start).map(event => {
              const connections = getNodeConnections(event);
              const insights = generateInsights(event);
              const isSelected = selectedNode?.id === event.id;
              
              return (
                <div 
                  key={event.id} 
                  className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedNode(isSelected ? null : event)}
                >
                  {/* ノードヘッダー */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold text-lg">{event.title}</h4>
                        <div className={`w-3 h-3 rounded-full ${event.color.value}`}></div>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {connections.length}個の接続
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDateTimeString(event.start)} {formatTime(event.start)}-{formatTime(event.end)}
                      </div>
                    </div>
                  </div>
                  
                  {/* タグネットワーク */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {event.tags.map(tag => (
                      <button
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200 flex items-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagEmail(tag);
                        }}
                        title="関連ネットワークにメール送信"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </button>
                    ))}
                  </div>
                  
                  {/* 内容プレビュー */}
                  {event.notes && (
                    <div className="bg-gray-50 p-3 rounded mb-3">
                      <p className="text-sm text-gray-700">{event.notes}</p>
                    </div>
                  )}
                  
                  {/* AI インサイト */}
                  {insights.length > 0 && (
                    <div className="bg-blue-50 p-3 rounded mb-3">
                      <div className="text-xs font-medium text-blue-700 mb-1">🧠 AIインサイト:</div>
                      {insights.map((insight, idx) => (
                        <div key={idx} className="text-xs text-blue-600">• {insight}</div>
                      ))}
                    </div>
                  )}
                  
                  {/* 接続プレビュー */}
                  {connections.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        🔗 強い関連性 (上位{Math.min(3, connections.length)}件):
                      </div>
                      <div className="space-y-1">
                        {connections.slice(0, 3).map((connection, idx) => (
                          <div key={idx} className="flex items-center text-xs text-gray-600">
                            <div className="flex items-center space-x-1 flex-1">
                              <div className={`w-2 h-2 rounded-full ${connection.event.color.value}`}></div>
                              <span className="truncate">{connection.event.title}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-16 bg-gray-200 rounded-full h-1">
                                <div 
                                  className="bg-blue-500 h-1 rounded-full" 
                                  style={{ width: `${connection.strength * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8">
                                {Math.round(connection.strength * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* サイドパネル: 選択ノードの詳細 */}
          <div className="space-y-4">
            {selectedNode ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-800 mb-2">📊 ネットワーク分析</h5>
                  <div className="space-y-2 text-sm">
                    {(() => {
                      const connections = getNodeConnections(selectedNode);
                      const strongConnections = connections.filter(c => c.strength > 0.5);
                      const avgStrength = connections.length > 0 
                        ? connections.reduce((sum, c) => sum + c.strength, 0) / connections.length 
                        : 0;
                      
                      return (
                        <>
                          <div>総接続数: <span className="font-medium">{connections.length}</span></div>
                          <div>強い接続: <span className="font-medium">{strongConnections.length}</span></div>
                          <div>平均関連度: <span className="font-medium">{Math.round(avgStrength * 100)}%</span></div>
                          <div>ネットワーク密度: <span className="font-medium">
                            {connections.length > 5 ? '高' : connections.length > 2 ? '中' : '低'}
                          </span></div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-semibold text-green-800 mb-2">🌿 知識の成長</h5>
                  <div className="text-sm space-y-1">
                    {(() => {
                      const sameTags = events.filter(e => 
                        e.id !== selectedNode.id && 
                        e.tags.some(tag => selectedNode.tags.includes(tag))
                      );
                      const recentRelated = sameTags.filter(e => 
                        Math.abs(e.start - selectedNode.start) < 7 * 24 * 60 * 60 * 1000
                      );
                      
                      return (
                        <>
                          <div>同系統ノード: {sameTags.length}個</div>
                          <div>近接時期: {recentRelated.length}個</div>
                          <div className="text-xs text-green-600 mt-2">
                            {sameTags.length > 3 && '🚀 活発な知識分野です'}
                            {recentRelated.length > 2 && '⚡ 最近の集中領域です'}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-gray-500 text-sm">
                  ノードをクリックして<br />詳細な関連性を確認
                </div>
              </div>
            )}
            
            {/* グローバル統計 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h5 className="font-semibold text-purple-800 mb-2">🌐 全体統計</h5>
              <div className="text-sm space-y-1">
                <div>総ノード数: {events.length}</div>
                <div>ユニークタグ: {allTags.length}</div>
                <div>平均タグ数: {(events.reduce((sum, e) => sum + e.tags.length, 0) / events.length).toFixed(1)}</div>
                <div>最大接続ノード: {(() => {
                  const maxConnections = Math.max(...events.map(e => getNodeConnections(e).length));
                  const maxNode = events.find(e => getNodeConnections(e).length === maxConnections);
                  return maxNode ? `${maxNode.title.slice(0, 10)}...` : 'なし';
                })()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                if (view === 'month') {
                  newDate.setMonth(newDate.getMonth() - 1);
                } else {
                  newDate.setDate(newDate.getDate() - 7);
                }
                setCurrentDate(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold min-w-48 text-center">
              {view === 'month' ? (
                `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
              ) : (
                `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
              )}
            </h2>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                if (view === 'month') {
                  newDate.setMonth(newDate.getMonth() + 1);
                } else {
                  newDate.setDate(newDate.getDate() + 7);
                }
                setCurrentDate(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              今日
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFreeTime(!showFreeTime)}
            className={`p-2 rounded ${showFreeTime ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'} hover:opacity-80`}
            title="空き時間表示切り替え"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className="p-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            title="日記"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowEventModal(true)}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="イベント追加"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="flex bg-gray-200 rounded">
            <button
              onClick={() => setView('month')}
              className={`p-2 rounded ${view === 'month' ? 'bg-blue-500 text-white' : 'text-gray-700'}`}
              title="月表示"
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setView('week')}
              className={`p-2 rounded ${view === 'week' ? 'bg-blue-500 text-white' : 'text-gray-700'}`}
              title="週表示"
            >
              <Clock className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* タブヘッダー */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-2 px-4 rounded-md text-center font-medium ${
            activeTab === 'calendar' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-5 h-5 inline mr-2" />
          カレンダー
        </button>
        <button
          onClick={() => setActiveTab('journal')}
          className={`flex-1 py-2 px-4 rounded-md text-center font-medium ${
            activeTab === 'journal' 
              ? 'bg-white text-purple-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="w-5 h-5 inline mr-2" />
          日記
        </button>
      </div>
      
      {/* カレンダー表示 */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-lg shadow">
          {view === 'month' ? renderMonthView() : renderWeekView()}
        </div>
      )}
      
      {/* 日記表示 */}
      {activeTab === 'journal' && renderJournalView()}
      
      {/* モーダル */}
      {renderEventModal()}
    </div>
  );
};

export default CalendarApp;