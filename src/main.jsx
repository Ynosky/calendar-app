import React, { useState, useEffect, useRef } from 'react';
import { saveEventToFirestore, loadEventsFromFirestore, deleteEventFromFirestore } from './firebase/saveEvents';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Tag, BookOpen, Copy, Mail, Search, Eye, RefreshCw } from 'lucide-react';
import GoogleCalendarSync from './google/googleCalendar';

const CalendarApp = () => {
  // Google Calendar同期関連の状態
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleSync, setGoogleSync] = useState(null);
  const [googleApiLoaded, setGoogleApiLoaded] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false); // 初期化試行フラグ

  // 新しい空き時間表示トグル
  const [showAvailability, setShowAvailability] = useState(false);
  const toggleAvailability = () => setShowAvailability(!showAvailability);
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
  // 複数タグ選択用
  const [selectedTags, setSelectedTags] = useState([]);
  const [showFreeTime, setShowFreeTime] = useState(false); // 空き時間の表示切り替え
  const [selectedNode, setSelectedNode] = useState(null); // 選択されたノード
  
  // 気分連動カラーシステム
  const moodColors = [
    // 低い気分 (1-3): 寒色系
    { mood: 1, name: '辛い', emoji: '😢', color: 'bg-gray-500', border: 'border-gray-500', gradient: 'from-gray-400 to-gray-600' },
    { mood: 2, name: '悲しい', emoji: '😔', color: 'bg-blue-600', border: 'border-blue-600', gradient: 'from-blue-500 to-blue-700' },
    { mood: 3, name: '沈んでる', emoji: '😞', color: 'bg-indigo-500', border: 'border-indigo-500', gradient: 'from-indigo-400 to-indigo-600' },
    
    // 普通の気分 (4-6): 中間色
    { mood: 4, name: '少し憂鬱', emoji: '😐', color: 'bg-purple-500', border: 'border-purple-500', gradient: 'from-purple-400 to-purple-600' },
    { mood: 5, name: '普通', emoji: '😊', color: 'bg-green-500', border: 'border-green-500', gradient: 'from-green-400 to-green-600' },
    { mood: 6, name: 'まあまあ', emoji: '🙂', color: 'bg-teal-500', border: 'border-teal-500', gradient: 'from-teal-400 to-teal-600' },
    
    // 高い気分 (7-10): 暖色系
    { mood: 7, name: '良い', emoji: '😄', color: 'bg-yellow-500', border: 'border-yellow-500', gradient: 'from-yellow-400 to-yellow-600' },
    { mood: 8, name: 'とても良い', emoji: '😁', color: 'bg-orange-500', border: 'border-orange-500', gradient: 'from-orange-400 to-orange-600' },
    { mood: 9, name: '最高', emoji: '🤩', color: 'bg-pink-500', border: 'border-pink-500', gradient: 'from-pink-400 to-pink-600' },
    { mood: 10, name: '超最高！', emoji: '🥳', color: 'bg-red-500', border: 'border-red-500', gradient: 'from-red-400 to-red-600' }
  ];

  // 気分から色データを取得（Firebase形式に合わせて変換）
  const getMoodColorData = (mood) => {
    const moodData = moodColors.find(m => m.mood === mood) || moodColors[4]; // デフォルトは普通(5)
    
    // Firebase の既存形式に合わせて color オブジェクトを返す
    return {
      name: moodData.name,
      value: moodData.color,  // "bg-orange-500" → Firebase の color フィールド
      border: moodData.border, // "border-orange-500" → Firebase の border フィールド
      emoji: moodData.emoji,
      gradient: moodData.gradient // プレビュー用
    };
  };

  // 従来のカラーシステム（互換性のため残す）
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

  // イベントデータ
  const [events, setEvents] = useState([]);

  // 初回読み込み時にFirestoreからイベントを取得
  useEffect(() => {
    loadEventsFromFirestore().then(fetchedEvents => {
      // tagsフィールドが配列であることを保証 + moodフィールドを追加 + 色データを復元
      const normalizedEvents = fetchedEvents.map(ev => {
        const mood = ev.mood || 5; // 既存イベントにmoodがない場合はデフォルト値
        
        // 既存の色データがある場合はそれを使用、なければ mood から生成
        let colorData;
        if (ev.color && ev.color.value) {
          // 既存の Firebase 形式の色データが存在
          colorData = ev.color;
        } else {
          // mood から色データを生成
          colorData = getMoodColorData(mood);
        }
        
        return {
          ...ev,
          tags: Array.isArray(ev.tags) ? ev.tags : [],
          mood: mood,
          color: colorData
        };
      });
      setEvents(normalizedEvents);
    });

    // Google API初期化（一度だけ）
    if (!initializationAttempted) {
      const timer = setTimeout(() => {
        initializeGoogleAPI();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [initializationAttempted]);

  // Google Calendar同期初期化
  const initializeGoogleAPI = async () => {
    if (initializationAttempted) return; // 重複実行防止
    
    setInitializationAttempted(true);
    
    try {
      console.log('Google API初期化開始');
      const sync = new GoogleCalendarSync();
      await sync.initialize();
      setGoogleSync(sync);
      setGoogleApiLoaded(true);
      console.log('Google Calendar API初期化完了');
    } catch (error) {
      console.error('Google API初期化エラー:', error);
      setGoogleApiLoaded(false);
      // 初期化に失敗した場合、フラグをリセットして手動再試行可能にする
      setInitializationAttempted(false);
    }
  };

  // 重複チェック関数
  const isDuplicateEvent = (newEvent, existingEvents) => {
    return existingEvents.some(existing => {
      // 同日同名のイベントをチェック
      const sameDay = 
        existing.start.getFullYear() === newEvent.start.getFullYear() &&
        existing.start.getMonth() === newEvent.start.getMonth() &&
        existing.start.getDate() === newEvent.start.getDate();
      
      const sameName = existing.title.toLowerCase() === newEvent.title.toLowerCase();
      
      return sameDay && sameName;
    });
  };

  // カレンダー一覧確認用のデバッグ関数
  const debugCalendarList = async () => {
    if (!googleSync) {
      alert('Google APIが初期化されていません');
      return;
    }

    try {
      await googleSync.listAvailableCalendars();
      alert('カレンダー一覧をConsole（F12）で確認してください');
    } catch (error) {
      console.error('カレンダー一覧取得エラー:', error);
      alert('カレンダー一覧の取得に失敗しました: ' + error.message);
    }
  };

  // Google Calendar同期実行
  const syncWithGoogleCalendar = async () => {
    // Google API読み込みチェック
    if (!googleApiLoaded || !googleSync) {
      // 初期化が失敗していた場合、再試行
      if (!initializationAttempted) {
        alert('Google APIを初期化しています...');
        await initializeGoogleAPI();
        return;
      }
      alert('Google APIの初期化に失敗しました。ページを再読み込みしてください。');
      return;
    }

    setIsSyncing(true);
    try {
      const googleEvents = await googleSync.fetchCurrentMonthEvents();

      // 重複チェックと追加
      const newEvents = [];
      for (const googleEvent of googleEvents) {
        if (!isDuplicateEvent(googleEvent, events)) {
          // Google Calendar イベントにデフォルト気分を追加
          const defaultMood = 5;
          const moodColorData = getMoodColorData(defaultMood);
          const eventWithMood = { 
            ...googleEvent, 
            mood: defaultMood,
            color: moodColorData // 適切な色オブジェクトを設定
          };
          
          // Firebase形式でFirestoreに保存（正しいcolor形式で）
          await saveEventToFirestore({
            id: eventWithMood.id,
            title: eventWithMood.title,
            start: eventWithMood.start,
            end: eventWithMood.end,
            tags: eventWithMood.tags,
            notes: eventWithMood.notes,
            mood: eventWithMood.mood,
            color: eventWithMood.color // 既に適切な形式のcolorオブジェクト
          });
          newEvents.push(eventWithMood);
        } else {
          console.log(`重複のため追加をスキップ: ${googleEvent.title}`);
        }
      }

      // ローカル状態を更新
      if (newEvents.length > 0) {
        setEvents(prev => [...prev, ...newEvents]);
        alert(`${newEvents.length}件のイベントをsatoryu@keio.jpから同期しました`);
      } else {
        alert('新しいイベントはありませんでした');
      }

      setIsGoogleConnected(true);
    } catch (error) {
      console.error('同期エラー:', error);
      if (error.message.includes('アクセス権限がありません')) {
        alert('satoryu@keio.jpのカレンダーへのアクセス権限がありません。カレンダーの共有設定を確認してください。');
      } else if (error.message.includes('not signed in') || error.message.includes('Authentication')) {
        alert('Googleアカウントの認証が必要です。再度お試しください。');
      } else {
        alert('Google Calendarとの同期に失敗しました: ' + error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    mood: 5, // 1-10の気分スケール（デフォルト: 普通）
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

  // イベント追加
  const handleAddEvent = async (newEvent) => {
    // Ensure tags is always an array
    const tagsArray = Array.isArray(newEvent.tags) ? newEvent.tags : [];
    
    // Firebase形式でデータを保存（正しいcolor形式で）
    await saveEventToFirestore({
      id: newEvent.id,
      title: newEvent.title,
      start: newEvent.start,
      end: newEvent.end,
      tags: tagsArray,
      notes: newEvent.notes || '',
      mood: newEvent.mood,
      color: newEvent.color // 既に適切な形式のcolorオブジェクト
    });
    setEvents((prev) => [...prev, { ...newEvent, tags: tagsArray }]);
  };

  // イベント追加/編集
  const handleEventSubmit = async () => {
    if (!eventForm.title || !eventForm.date || !eventForm.startTime || !eventForm.endTime) {
      alert('必要な項目を入力してください');
      return;
    }

    const [year, month, day] = eventForm.date.split('-').map(Number);
    const [startHour, startMinute] = eventForm.startTime.split(':').map(Number);
    const [endHour, endMinute] = eventForm.endTime.split(':').map(Number);

    // 開始日時と終了日時を作成
    const startDate = createJapanDate(year, month - 1, day, startHour, startMinute);
    let endDate = createJapanDate(year, month - 1, day, endHour, endMinute);

    // 終了時間が開始時間より早い場合、翌日に設定
    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000); // 24時間追加
    }

    // tagsを配列として保存
    const formTags = eventForm.tags
      ? eventForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      : [];

    // 気分に基づいた色データを取得
    const moodColorData = getMoodColorData(eventForm.mood);

    const newEvent = {
      id: editingEvent ? editingEvent.id : Date.now().toString(),
      title: eventForm.title,
      start: startDate,
      end: endDate,
      color: moodColorData, // 気分に基づいた完全な色オブジェクト
      mood: eventForm.mood, // 気分を保存
      tags: Array.isArray(formTags) ? formTags : [],
      notes: eventForm.notes || '',
    };

    if (editingEvent) {
      // Firestoreへの保存処理（正しいcolor形式で）
      await saveEventToFirestore({
        id: newEvent.id,
        title: newEvent.title,
        start: newEvent.start,
        end: newEvent.end,
        tags: newEvent.tags,
        notes: newEvent.notes,
        mood: newEvent.mood,
        color: newEvent.color // 既に適切な形式のcolorオブジェクト
      });
      setEvents(events.map(event => event.id === editingEvent.id ? newEvent : event));
    } else {
      await handleAddEvent(newEvent);
    }

    setShowEventModal(false);
    setEditingEvent(null);
    setEventForm({
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      mood: 5, // デフォルト気分
      tags: '',
      notes: ''
    });
  };

  // イベント削除
  const handleDelete = async (id) => {
    try {
      await deleteEventFromFirestore(id);
      setEvents(prev => prev.filter(event => event.id !== id)); // Update local state
      setShowEventModal(false); // Optionally close the modal
      setEditingEvent(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  // イベント編集開始
  const startEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      date: formatDate(event.start),
      startTime: formatTime(event.start),
      endTime: formatTime(event.end),
      mood: event.mood || 5, // 既存イベントの気分を復元
      tags: Array.isArray(event.tags) ? event.tags.join(', ') : '',
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
      endTime: '10:00',
      mood: 5 // デフォルト気分
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
      endTime: `${endHour.toString().padStart(2, '0')}:00`,
      mood: 5 // デフォルト気分
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
    // 例: "1月6日11:00~11:30"
    const copyText = `${month}月${day}日${startTimeStr}~${endTimeStr}`;
    navigator.clipboard.writeText(copyText).then(() => {
      alert("コピーしました");
    });
  };

  // タグベースでのメール送信
  const handleTagEmail = (tag) => {
    const relatedEvents = events.filter(event => Array.isArray(event.tags) && event.tags.includes(tag));
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
      Array.isArray(event.tags) &&
      event.tags.some(tag => tags.includes(tag)) &&
      event.start < new Date()
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
  // 削除: 週ビューの空き時間表示切り替えボタン
  // Helper: 曜日文字列
  const weekDayStr = (date) => ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  const renderWeekView = () => {
    const weekStart = getWeekStart(currentDate);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });

    return (
      <div className="flex relative">
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
          // 空き時間ブロック
          const dayAvailBlocks = getFreeTimeBlocks(date);

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
                {/* 空き時間ブロック */}
                {showFreeTime && (
                  <div>
                    {dayAvailBlocks.map((block, idx) => {
                      // 表示用
                      const startTimeStr = formatTime(block.start);
                      const endTimeStr = formatTime(block.end);
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      const availText = `${month}月${day}日 ${startTimeStr}~${endTimeStr}`;
                      // 位置計算
                      const top =
                        (block.start.getHours() + block.start.getMinutes() / 60) * 32 + 0; // 32px/1h
                      const height =
                        ((block.end - block.start) / (1000 * 60 * 60)) * 32;
                      return (
                        <div
                          key={idx}
                          className="absolute left-1 right-1 bg-green-300 bg-opacity-80 text-green-900 border border-green-400 rounded px-2 py-1 text-xs font-semibold cursor-pointer z-30 hover:bg-green-400 transition-all"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            minHeight: '32px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            // クリップボードにコピー
                            await navigator.clipboard.writeText(availText);
                          }}
                          title="クリックで時間帯をコピー"
                        >
                          <span>{availText}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* 既存のイベントスロット */}
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
                              className={`absolute left-1 right-1 ${event.color.value} text-white text-xs p-1 rounded cursor-pointer z-20`}
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

    const currentMoodData = getMoodColorData(eventForm.mood);

    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-slide-up">
            
            {/* ヘッダー */}
            <div className={`bg-gradient-to-r ${currentMoodData?.gradient} text-white p-6`}>
              {/* モバイル用：スワイプインジケーター */}
              <div className="w-12 h-1 bg-white bg-opacity-30 rounded-full mx-auto mb-4 sm:hidden"></div>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-4xl mr-3">{currentMoodData?.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold">
                      {editingEvent ? '思い出を編集' : '新しい思い出'}
                    </h3>
                    <p className="text-white text-opacity-80 text-sm">気分: {currentMoodData?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowEventModal(false);
                    setEditingEvent(null);
                    setEventForm({
                      title: '',
                      date: '',
                      startTime: '',
                      endTime: '',
                      mood: 5,
                      tags: '',
                      notes: ''
                    });
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* タイトル入力をヘッダーに移動 */}
              <div>
                <input
                  type="text"
                  className="w-full bg-white bg-opacity-20 border-2 border-white border-opacity-30 rounded-xl px-4 py-3 text-lg text-white placeholder-white placeholder-opacity-70 focus:bg-opacity-30 focus:border-opacity-60 focus:ring-0 focus:outline-none transition-all"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="何をしましたか？"
                />
              </div>
            </div>

            {/* コンテンツエリア - スクロール可能 */}
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              <div className="p-6 space-y-6">

                {/* 気分スライダー */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                    <span className="mr-2">💝</span>
                    今日の気分 ({eventForm.mood}/10)
                  </label>
                  
                  {/* 気分スライダー */}
                  <div className="relative">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={eventForm.mood}
                      onChange={(e) => setEventForm({...eventForm, mood: parseInt(e.target.value)})}
                      className="w-full h-3 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #6b7280 0%, #3b82f6 20%, #8b5cf6 40%, #10b981 50%, #eab308 60%, #f97316 80%, #ef4444 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>😢 辛い</span>
                      <span>😊 普通</span>
                      <span>🥳 最高</span>
                    </div>
                  </div>

                  {/* 選択された気分の表示 */}
                  <div className={`mt-4 p-4 rounded-xl bg-gradient-to-r ${currentMoodData?.gradient} bg-opacity-20 border-l-4 ${currentMoodData?.color}`}>
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">{currentMoodData?.emoji}</span>
                      <div>
                        <div className="font-bold text-gray-800">{currentMoodData?.name}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* タグ */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">🏷️</span>
                    タグ
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-orange-400 focus:ring-0 focus:outline-none transition-all"
                    value={eventForm.tags}
                    onChange={(e) => setEventForm({...eventForm, tags: e.target.value})}
                    placeholder="楽しい, リラックス"
                  />
                </div>

                {/* ノート */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">📝</span>
                    今日の記録
                  </label>
                  <textarea
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base leading-relaxed resize-none focus:border-orange-400 focus:ring-0 focus:outline-none transition-all"
                    value={eventForm.notes}
                    onChange={(e) => setEventForm({...eventForm, notes: e.target.value})}
                    placeholder="今日はどんな一日でしたか？

• 何を感じましたか？
• 何を学びましたか？
• 良かったことは？

自由に書いてください..."
                    rows={6}
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {eventForm.notes.length} 文字
                  </div>
                </div>

                {/* 日時 */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">日付</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-orange-400 focus:ring-0 focus:outline-none"
                      value={eventForm.date}
                      onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">開始</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-orange-400 focus:ring-0 focus:outline-none"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">終了</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-orange-400 focus:ring-0 focus:outline-none"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                    />
                  </div>
                </div>

                {/* 気分カラーのプレビュー */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">📊 カレンダー表示プレビュー</div>
                  <div className={`p-3 rounded-lg ${currentMoodData?.color} bg-gradient-to-r ${currentMoodData?.gradient} bg-opacity-80 shadow-sm`}>
                    <div className="flex items-center justify-between text-white">
                      <div>
                        <div className="font-medium">{eventForm.title || '新しいイベント'}</div>
                        <div className="text-sm opacity-90">{eventForm.startTime} - {eventForm.endTime}</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* フッター：固定ボタン */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="flex space-x-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEventModal(false);
                    setEditingEvent(null);
                    setEventForm({
                      title: '',
                      date: '',
                      startTime: '',
                      endTime: '',
                      mood: 5,
                      tags: '',
                      notes: ''
                    });
                  }}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all"
                >
                  キャンセル
                </button>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEvent.id)}
                    className="py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all"
                  >
                    🗑️
                  </button>
                )}
                <button 
                  type="button"
                  onClick={handleEventSubmit}
                  className={`flex-2 py-3 px-6 bg-gradient-to-r ${currentMoodData?.gradient} hover:scale-105 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center`}
                >
                  <span className="mr-2">💾</span>
                  {editingEvent ? '更新' : '保存'}
                </button>
              </div>
            </div>

          </div>
        </div>
        
        {/* CSS スタイル */}
        <style jsx>{`
          .animate-slide-up {
            animation: slideUp 0.3s ease-out;
          }
          
          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
            border: 3px solid #f97316;
          }
          
          .slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
            border: 3px solid #f97316;
          }
          
          @media (max-width: 640px) {
            .animate-slide-up {
              animation: slideUpMobile 0.3s ease-out;
            }
            
            @keyframes slideUpMobile {
              from {
                transform: translateY(50%);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
          }
        `}</style>
      </>
    );
  };

  // ツェッテルカステン風日記ビューのレンダリング
  const renderJournalView = () => {
    // ハイライト用関数
    const getHighlightStyle = (count) => {
      if (count >= 9) return { background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)", borderLeft: "4px solid #f59e0b" };
      if (count >= 7) return { background: "#fef3c7", borderLeft: "4px solid #fbbf24" };
      if (count >= 5) return { background: "#fed7aa", borderLeft: "4px solid #fbbf24" };
      if (count >= 3) return { background: "#fff7ed", borderLeft: "4px solid #f59e0b" };
      if (count >= 1) return { background: "#fff7ed", borderLeft: "4px solid #fed7aa" };
      return {};
    };
    const allTags = [...new Set(events.flatMap(event => Array.isArray(event.tags) ? event.tags : []))];
    // タグ複数選択フィルタ
    const filteredEvents = (selectedTags.length > 0)
      ? events.filter(event =>
          Array.isArray(event.tags) && selectedTags.every(tag => event.tags.includes(tag))
        )
      : (
        searchTag
          ? events.filter(event =>
              (Array.isArray(event.tags) && event.tags.some(tag => tag.toLowerCase().includes(searchTag.toLowerCase()))) ||
              event.title.toLowerCase().includes(searchTag.toLowerCase()) ||
              (event.notes && event.notes.toLowerCase().includes(searchTag.toLowerCase()))
            )
          : events
      );

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
              const tagEvents = events.filter(e => Array.isArray(e.tags) && e.tags.includes(tag));
              const intensity = Math.min(tagEvents.length / 3, 1);
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  className={`text-sm px-3 py-1 rounded-full transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  style={{
                    opacity: 0.6 + (intensity * 0.4),
                    fontSize: `${0.875 + (intensity * 0.125)}rem`
                  }}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedTags(selectedTags.filter(t => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
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
          <div className="lg:col-span-2 space-y-4 max-h-[480px] overflow-y-auto">
            {filteredEvents.sort((a, b) => b.start - a.start).map(event => {
              const connections = getNodeConnections(event);
              const insights = generateInsights(event);
              const isSelected = selectedNode?.id === event.id;
              // connectionCount = connections.length
              const connectionCount = connections.length;
              return (
                <div
                  key={event.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  } diary-card`}
                  style={getHighlightStyle(connectionCount)}
                  onClick={() => setSelectedNode(isSelected ? null : event)}
                >
                  {/* ノードヘッダー */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold text-lg">{event.title}</h4>
                        <div className={`w-3 h-3 rounded-full ${event.color.value}`}></div>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          <span style={{ color: "#f59e0b" }}>{connections.length}</span>個の接続
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDateTimeString(event.start)} {formatTime(event.start)}-{formatTime(event.end)}
                      </div>
                    </div>
                  </div>
                  
                  {/* タグネットワーク */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(Array.isArray(event.tags) ? event.tags : []).map(tag => (
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
                                <span style={{ color: "#f59e0b" }}>{Math.round(connection.strength * 100)}</span>%
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
                        Array.isArray(e.tags) &&
                        Array.isArray(selectedNode.tags) &&
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
                <div>平均タグ数: {(events.reduce((sum, e) => sum + (Array.isArray(e.tags) ? e.tags.length : 0), 0) / (events.length || 1)).toFixed(1)}</div>
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

  // トグルボタン用関数
  const toggleFreeTime = () => setShowFreeTime(prev => !prev);

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-6">
        <div className="left-buttons flex space-x-2">
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

        {/* Second row of buttons: responsive flex layout for mobile */}
        <div className="right-buttons button-row flex flex-row flex-wrap justify-between w-full sm:w-auto space-x-2 mt-2 sm:mt-0">
          <button
            onClick={syncWithGoogleCalendar}
            disabled={isSyncing || !googleApiLoaded}
            className={`flex-1 text-center p-2 rounded hover:bg-green-600 ${
              isSyncing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : !googleApiLoaded
                  ? 'bg-gray-300 cursor-not-allowed'
                  : isGoogleConnected 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-500 text-white'
            }`}
            title={
              isSyncing 
                ? '同期中...' 
                : !googleApiLoaded 
                  ? 'Google API読み込み中...'
                  : 'Google Calendar同期'
            }
          >
            {isSyncing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setShowEventModal(true)}
            className="flex-1 text-center p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="イベント追加"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div
            className={`flex-1 text-center p-2 rounded-full cursor-pointer ${showFreeTime ? 'bg-green-200' : 'bg-gray-200'}`}
            onClick={() => setShowFreeTime(prev => !prev)}
            title="空き時間表示切り替え"
          >
            <Eye className="w-5 h-5 text-gray-800 mx-auto" />
          </div>
          <div className="flex flex-row flex-1 bg-gray-200 rounded">
            <button
              onClick={() => setView('month')}
              className={`flex-1 text-center p-2 rounded ${view === 'month' ? 'bg-blue-500 text-white' : 'text-gray-700'}`}
              title="月表示"
            >
              <Calendar className="w-5 h-5 mx-auto" />
            </button>
            <button
              onClick={() => setView('week')}
              className={`flex-1 text-center p-2 rounded ${view === 'week' ? 'bg-blue-500 text-white' : 'text-gray-700'}`}
              title="週表示"
            >
              <Clock className="w-5 h-5 mx-auto" />
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
          {view === 'month' ? (
            <>
              {showFreeTime && (
                <div className="p-4 mb-4">
                  {/* 空き時間ブロックを表示 */}
                  {(() => {
                    // 当月の日付を取得
                    const firstDay = getFirstDayOfMonth(currentDate);
                    const daysInMonth = getDaysInMonth(currentDate);
                    const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
                      return new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                    });
                    return (
                      <div>
                        <h3 className="font-semibold mb-2 text-green-700">空き時間ブロック（月内、1時間以上）</h3>
                        <div className="space-y-2">
                          {daysArray.map(date => {
                            const freeBlocks = getFreeTimeBlocks(date);
                            if (freeBlocks.length === 0) return null;
                            return (
                              <div key={date.toISOString()} className="bg-green-50 border border-green-200 rounded p-2">
                                <div className="font-medium mb-1">
                                  {date.getMonth() + 1}月{date.getDate()}日（{weekDays[date.getDay()]}）
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {freeBlocks.map((block, idx) => {
                                    const startStr = formatTime(block.start);
                                    const endStr = formatTime(block.end);
                                    const text = `${startStr}~${endStr}`;
                                    return (
                                      <button
                                        key={idx}
                                        className="bg-green-200 text-green-900 px-3 py-1 rounded shadow text-xs hover:bg-green-300"
                                        onClick={() => handleFreeTimeBlockClick(date, block.start, block.end)}
                                        title="クリックでコピー"
                                      >
                                        {text}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {renderMonthView()}
            </>
          ) : (
            renderWeekView()
          )}
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