import { batchService } from './batchService';
import { hatchBasketService } from './hatchBasketService';
import { isTodayOrPast, todayDateOnly } from '../utils/today';

export const dashboardService = {
  async getDailyTasks() {
    const [batches, baskets] = await Promise.all([batchService.list(), hatchBasketService.listWithUsage()]);
    return {
      transferDue: batches.filter((batch) => batch.status === 'INCUBATING' && isTodayOrPast(batch.transferDate)),
      expectedToday: batches.filter((batch) => batch.expectedHatchDate === todayDateOnly()),
      inHatchBasket: baskets.reduce((sum, basket) => sum + basket.used, 0),
      waitingDelivery: batches.filter((batch) => batch.status === 'HATCHED'),
    };
  },
};
