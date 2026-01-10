"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlotIndex = getSlotIndex;
const MINUTES_PER_SLOT = 5;
const SLOTS_PER_HOUR = 60 / MINUTES_PER_SLOT;
/**
 *
 * @param hours - The hour of the day
 * @param minutes - The minute of the hour
 * @returns An index representing a particular time slot in a day
 */
function getSlotIndex(hours, minutes) {
    if (minutes % MINUTES_PER_SLOT !== 0) {
        throw new Error(`Minutes must be a multiple of ${MINUTES_PER_SLOT}`);
    }
    return hours * SLOTS_PER_HOUR + minutes / MINUTES_PER_SLOT;
}
//# sourceMappingURL=getSlotIndex.js.map