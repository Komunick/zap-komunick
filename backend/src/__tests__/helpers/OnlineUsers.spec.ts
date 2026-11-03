import {
  buildOnlinePanel,
  classifyOnlineUser,
  OnlineUserInput
} from "../../helpers/OnlineUsers";

// Monday, 26/10/2026 at 15:00
const now = new Date(2026, 9, 26, 15, 0);

const base: OnlineUserInput = {
  id: 1,
  name: "Ana",
  profile: "user",
  online: false,
  openCount: 0,
  pausedCount: 0,
  closedToday: 0,
  queues: []
};

describe("classifyOnlineUser", () => {
  it("tells how long an online user has been connected", () => {
    const user = classifyOnlineUser(
      { ...base, online: true, onlineSince: new Date(2026, 9, 26, 13, 30) },
      now
    );
    expect(user.situation).toBe("online");
    expect(user.minutesOnline).toBe(90);
    expect(user.minutesSinceSeen).toBeNull();
  });

  it("tells when an offline user was last seen", () => {
    const user = classifyOnlineUser(
      { ...base, lastSeen: new Date(2026, 9, 26, 14, 50) },
      now
    );
    expect(user.situation).toBe("offline");
    expect(user.minutesSinceSeen).toBe(10);
    expect(user.minutesOnline).toBeNull();
  });

  it("flags an attendant still connected outside the access hours", () => {
    const accessHours = {
      weekdays: [1, 2, 3, 4, 5],
      start: "08:00",
      end: "12:00"
    };
    expect(
      classifyOnlineUser({ ...base, online: true, accessHours }, now).situation
    ).toBe("outsideHours");
    expect(
      classifyOnlineUser(
        { ...base, online: true, accessHours, profile: "admin" },
        now
      ).situation
    ).toBe("online");
  });

  it("never reports a user without sessions as seen", () => {
    expect(classifyOnlineUser(base, now).minutesSinceSeen).toBeNull();
  });

  it("turns the counts that come from SQL into numbers", () => {
    const user = classifyOnlineUser(
      { ...base, openCount: "3" as never, closedToday: null as never },
      now
    );
    expect(user.openCount).toBe(3);
    expect(user.closedToday).toBe(0);
  });
});

describe("buildOnlinePanel", () => {
  const users: OnlineUserInput[] = [
    { ...base, id: 1, name: "Bruno", online: true, openCount: 1 },
    { ...base, id: 2, name: "Ana", online: true, openCount: 4 },
    { ...base, id: 3, name: "Carla", lastSeen: new Date(2026, 9, 26, 9, 0) },
    { ...base, id: 4, name: "Davi", lastSeen: new Date(2026, 9, 26, 14, 0) },
    { ...base, id: 5, name: "Eva", online: true },
    {
      ...base,
      id: 6,
      name: "Fábio",
      online: true,
      openCount: 2,
      accessHours: { weekdays: [6], start: "08:00", end: "12:00" }
    }
  ];

  it("puts the flagged first, then the busiest online, then who left last", () => {
    expect(buildOnlinePanel(users, now).users.map(u => u.name)).toEqual([
      "Fábio",
      "Ana",
      "Bruno",
      "Eva",
      "Davi",
      "Carla"
    ]);
  });

  it("sums the team", () => {
    expect(buildOnlinePanel(users, now).summary).toEqual({
      online: 4,
      offline: 2,
      outsideHours: 1,
      inService: 7,
      idle: 1
    });
  });
});
