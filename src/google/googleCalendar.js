// src/google/googleCalendar.js
class GoogleCalendarSync {
    constructor() {
      this.accessToken = null;
      this.isInitialized = false;
      this.targetCalendarId = 'satoryu@keio.jp'; // 読み取り対象のカレンダーID
    }
  
    // Google API初期化
    async initialize() {
      return new Promise((resolve, reject) => {
        // Google APIとGoogle Identity Servicesの両方が読み込まれるまで待機
        const checkAPIs = () => {
          if (typeof window.gapi !== 'undefined' && typeof window.google !== 'undefined') {
            this.initializeAPIs().then(resolve).catch(reject);
          } else {
            setTimeout(checkAPIs, 100);
          }
        };
        checkAPIs();
      });
    }
  
    async initializeAPIs() {
      try {
        console.log('Google API初期化開始');
        
        // Google API client初期化
        await new Promise((resolve) => {
          window.gapi.load('client', resolve);
        });
  
        await window.gapi.client.init({
          apiKey: 'AIzaSyAW-W1RnjVEZpbC3A5Rz88cGjnmODrgpPM',
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
        });
  
        this.isInitialized = true;
        console.log('Google API初期化完了');
      } catch (error) {
        console.error('Google API初期化エラー:', error);
        throw error;
      }
    }
  
    // 新しい認証方式
    async authenticate() {
      return new Promise((resolve, reject) => {
        if (!this.isInitialized) {
          reject(new Error('Google API not initialized'));
          return;
        }
  
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: '228559677073-jsja4q7o236oqrltj4nqgcc26oi4t7eo.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/calendar.readonly',
            callback: (response) => {
              if (response.error) {
                console.error('認証エラー:', response.error);
                reject(new Error(response.error));
                return;
              }
              
              this.accessToken = response.access_token;
              // Google API clientにアクセストークンを設定
              window.gapi.client.setToken({
                access_token: this.accessToken
              });
              
              console.log('認証完了');
              resolve(response);
            },
          });
  
          console.log('認証開始');
          tokenClient.requestAccessToken();
        } catch (error) {
          console.error('認証初期化エラー:', error);
          reject(error);
        }
      });
    }
  
    // 利用可能なカレンダー一覧を取得（デバッグ用）
    async listAvailableCalendars() {
      try {
        if (!this.accessToken) {
          await this.authenticate();
        }
  
        const response = await window.gapi.client.calendar.calendarList.list();
        const calendars = response.result.items || [];
        
        console.log('利用可能なカレンダー:');
        calendars.forEach(calendar => {
          console.log(`- ID: ${calendar.id}, 名前: ${calendar.summary}, アクセスレベル: ${calendar.accessRole}`);
        });
        
        return calendars;
      } catch (error) {
        console.error('カレンダー一覧取得エラー:', error);
        throw error;
      }
    }
  
    // 指定したカレンダーの今月のイベントを取得
    async fetchCurrentMonthEvents() {
      try {
        if (!this.accessToken) {
          await this.authenticate();
        }
  
        console.log(`Google Calendar同期開始 (カレンダー: ${this.targetCalendarId})`);
  
        // 今月の開始と終了
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
        console.log('期間:', startOfMonth.toISOString(), 'から', endOfMonth.toISOString());
  
        // 指定したカレンダーIDからイベントを取得
        const response = await window.gapi.client.calendar.events.list({
          calendarId: this.targetCalendarId, // satoryu@keio.jp を指定
          timeMin: startOfMonth.toISOString(),
          timeMax: endOfMonth.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250
        });
  
        const events = response.result.items || [];
        console.log(`${events.length}件のイベントを取得 (from ${this.targetCalendarId})`);
        
        return events.map(event => {
          // 開始・終了時間の処理
          const start = event.start.dateTime 
            ? new Date(event.start.dateTime)
            : new Date(event.start.date + 'T00:00:00');
          
          const end = event.end.dateTime
            ? new Date(event.end.dateTime)
            : new Date(event.end.date + 'T23:59:59');
  
          return {
            id: `google_${event.id}`,
            title: event.summary || '（タイトルなし）',
            start: start,
            end: end,
            tags: ['Google', 'Keio'], // タグにKeioを追加
            notes: event.description || '',
            color: { name: 'グリーン', value: 'bg-green-500', border: 'border-green-500' },
            isGoogleEvent: true,
            sourceCalendar: this.targetCalendarId // どのカレンダーから取得したかを記録
          };
        });
  
      } catch (error) {
        console.error('Google Calendar同期詳細エラー:', error);
        
        // 403エラー（アクセス権限なし）の場合の詳細メッセージ
        if (error.status === 403) {
          throw new Error(`カレンダー「${this.targetCalendarId}」へのアクセス権限がありません。カレンダーの共有設定を確認してください。`);
        }
        
        // 404エラー（カレンダーが見つからない）の場合
        if (error.status === 404) {
          throw new Error(`カレンダー「${this.targetCalendarId}」が見つかりません。カレンダーIDを確認してください。`);
        }
        
        throw error;
      }
    }
  
    // カレンダーIDを変更する関数（必要に応じて）
    setTargetCalendar(calendarId) {
      this.targetCalendarId = calendarId;
      console.log(`読み取り対象カレンダーを ${calendarId} に変更しました`);
    }
  }
  
  export default GoogleCalendarSync;