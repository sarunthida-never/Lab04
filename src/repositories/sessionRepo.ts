import { Session } from '../types';
import { createAsyncStore } from './asyncStore';

export const sessionRepo = createAsyncStore<Session>((s) => s.token);
