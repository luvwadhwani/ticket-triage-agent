import t1 from './t1.json';
import t2 from './t2.json';
import t3 from './t3.json';
import t4 from './t4.json';
import t5 from './t5.json';
import t6 from './t6.json';
import t7 from './t7.json';
import t8 from './t8.json';

/** Raw recordings; always read them through getRecording(), which validates. */
export const recordings: Record<string, unknown> = { t1, t2, t3, t4, t5, t6, t7, t8 };
