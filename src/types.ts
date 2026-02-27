export enum PresentationStatus {
  NOT_SELECTED = 0,
  ASSIGNED = 10,
  PRESENTED = 20,
}

export interface Presenter {
  name: string;
  presentationStatus: PresentationStatus;
}

export interface ApiResponse<T = any> {
  presenters?: Presenter[];
  message?: string;
  error?: string;
  data?: T;
}

export interface AppState {
  presenters: Presenter[];
  isLoading: boolean;
  error: string | null;
  isSelecting: boolean;
  showAddForm: boolean;
  newPresenterName: string;
}

export interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export interface AddPresenterFormProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  existingNames: string[];
}

export interface PresenterItemProps {
  presenter: Presenter;
  onRemove: (name: string) => void;
  isRemoving: boolean;
}