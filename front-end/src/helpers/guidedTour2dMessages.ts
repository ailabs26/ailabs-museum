import type { PublicLocale } from './publicLocale';

export const GUIDED_TOUR_2D_MESSAGES = {
  vi: {
    label: 'Điều khiển tham quan 2D', recoveryLabel: 'Phục hồi bước tham quan', progressLabel: 'Tiến độ tham quan',
    step: 'Bước', start: 'Bắt đầu tham quan 2D', continue: 'Tiếp tục tham quan',
    startFromExhibit: 'Bắt đầu từ hiện vật này', returnToStep: 'Quay lại bước đang tham quan', routeDrift: 'Hành trình đang ở hiện vật {exhibit}. Bạn có thể quay lại bước đó hoặc thoát hướng dẫn.', restart: 'Bắt đầu lại',
    running: 'Đang tham quan', paused: 'Đã tạm dừng', completed: 'Hoàn thành', empty: 'Phòng này chưa có hiện vật để tham quan.',
  },
  en: {
    label: '2D guided tour controls', recoveryLabel: 'Tour step recovery', progressLabel: 'Tour progress',
    step: 'Step', start: 'Start 2D tour', continue: 'Continue tour',
    startFromExhibit: 'Start from this exhibit', returnToStep: 'Return to the current tour step', routeDrift: 'The tour is at {exhibit}. Return to that step or exit the tour.', restart: 'Restart tour',
    running: 'Tour in progress', paused: 'Paused', completed: 'Completed', empty: 'This room has no published exhibits to visit.',
  },
  fr: {
    label: 'Commandes de visite guidée 2D', recoveryLabel: 'Reprise de la visite guidée', progressLabel: 'Progression de la visite',
    step: 'Étape', start: 'Commencer la visite 2D', continue: 'Continuer la visite',
    startFromExhibit: 'Commencer par cet objet', returnToStep: 'Revenir à l’étape actuelle', routeDrift: 'La visite en est à « {exhibit} ». Revenez à cette étape ou quittez la visite.', restart: 'Recommencer la visite',
    running: 'Visite en cours', paused: 'En pause', completed: 'Visite terminée', empty: 'Cette salle ne contient aucun objet publié à visiter.',
  },
  zh: {
    label: '2D 导览控制', recoveryLabel: '导览步骤恢复', progressLabel: '导览进度',
    step: '步骤', start: '开始 2D 导览', continue: '继续导览',
    startFromExhibit: '从此展品开始', returnToStep: '返回当前导览步骤', routeDrift: '导览当前位于“{exhibit}”。您可以返回该步骤或退出导览。', restart: '重新开始导览',
    running: '导览进行中', paused: '已暂停', completed: '导览完成', empty: '此展厅暂无已发布的展品。',
  },
  ko: {
    label: '2D 가이드 투어 컨트롤', recoveryLabel: '투어 단계 복구', progressLabel: '투어 진행률',
    step: '단계', start: '2D 투어 시작', continue: '투어 계속하기',
    startFromExhibit: '이 전시물부터 시작', returnToStep: '현재 투어 단계로 돌아가기', routeDrift: '투어는 현재 {exhibit} 단계입니다. 해당 단계로 돌아가거나 투어를 종료할 수 있습니다.', restart: '투어 다시 시작',
    running: '투어 진행 중', paused: '일시 정지됨', completed: '투어 완료', empty: '이 전시실에는 공개된 전시물이 없습니다.',
  },
  ja: {
    label: '2D ガイドツアー操作', recoveryLabel: 'ツアー手順の復旧', progressLabel: 'ツアーの進行状況',
    step: 'ステップ', start: '2D ツアーを開始', continue: 'ツアーを続ける',
    startFromExhibit: 'この展示物から開始', returnToStep: '現在のツアー手順に戻る', routeDrift: 'ツアーは「{exhibit}」にいます。その手順に戻るか、ツアーを終了できます。', restart: 'ツアーを再開',
    running: 'ツアー中', paused: '一時停止中', completed: 'ツアー完了', empty: 'この展示室には公開中の展示物がありません。',
  },
} satisfies Record<PublicLocale, {
  label: string; recoveryLabel: string; progressLabel: string; step: string; start: string; continue: string;
  startFromExhibit: string; returnToStep: string; routeDrift: string; restart: string;
  running: string; paused: string; completed: string; empty: string;
}>;
