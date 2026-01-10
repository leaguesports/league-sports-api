import { getSlotIndex } from "./util/getSlotIndex";

type Slot = number;
type BookingCount = number;

class Time {
  hours: number;
  minutes: number;

  constructor(hours: number, minutes: number) {
    this.hours = hours;
    this.minutes = minutes;
  }
}

class TimeSlot {
  start: Time;
  end: Time;

  constructor(start: Time, end: Time) {
    this.start = start;
    this.end = end;
  }
}

class Activity {
  durationInMinutes: number;
  availableStationCount: number;
  slots: Map<Slot, BookingCount> = new Map();

  constructor(durationInMinutes: number, availableStationCount: number) {
    this.durationInMinutes = durationInMinutes;
    this.availableStationCount = availableStationCount;

    for (let slot = 0; slot < 288; slot++) {
      this.slots.set(slot, 0);
    }
  }

  getTimeSlotAvailability(timeSlots: TimeSlot[]) {
    const availability: any[] = [];

    for (const timeSlot of timeSlots) {
      const startSlot = getSlotIndex(
        timeSlot.start.hours,
        timeSlot.start.minutes
      );

      const endSlot = getSlotIndex(timeSlot.end.hours, timeSlot.end.minutes);

      let bookings: number[] = [0];

      for (let slot = startSlot; slot <= endSlot; slot++) {
        const bookingsCount = this.slots.get(slot) || 0;
        bookings.push(bookingsCount);
      }

      const maxBookedStations = Math.max(...bookings);
      let availableStationCount =
        this.availableStationCount - maxBookedStations;

      if (availableStationCount < 0) {
        availableStationCount = 0;
      }

      availability.push({
        start: timeSlot.start,
        end: timeSlot.end,
        availableStationCount,
      });
    }

    return availability;
  }

  addBooking(timeSlot: TimeSlot) {
    const startSlot = getSlotIndex(
      timeSlot.start.hours,
      timeSlot.start.minutes
    );

    const endSlot = getSlotIndex(timeSlot.end.hours, timeSlot.end.minutes);

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const bookingsCount = this.slots.get(slot) || 0;

      if (bookingsCount >= this.availableStationCount) {
        throw new Error("No available stations");
      }

      this.slots.set(slot, bookingsCount + 1);
    }
  }
}

describe(Activity, () => {
  test("it should work", () => {
    const simRacing = new Activity(30, 3);
    const timeSlot = new TimeSlot(new Time(10, 0), new Time(10, 30));

    let availability = simRacing.getTimeSlotAvailability([timeSlot]);

    expect(availability).toEqual([
      {
        start: new Time(10, 0),
        end: new Time(10, 30),
        availableStationCount: 3,
      },
    ]);

    simRacing.addBooking(timeSlot);

    availability = simRacing.getTimeSlotAvailability([timeSlot]);

    expect(availability).toEqual([
      {
        start: new Time(10, 0),
        end: new Time(10, 30),
        availableStationCount: 2,
      },
    ]);
  });
});
