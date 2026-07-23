import { describe, it, expect } from "vitest";
import { listRooms } from "./rooms";

describe("listRooms", () => {
  it("会議室一覧を表示名(name)の昇順で返す", async () => {
    const rooms = await listRooms();
    const names = rooms.map((r) => r.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "ja"));
    expect(names).toEqual(sorted);
    expect(rooms.length).toBeGreaterThan(0);
  });

  it("会議室Aの営業時間・定員がcontractsのBackgroundと一致する", async () => {
    const rooms = await listRooms();
    const roomA = rooms.find((r) => r.roomId === "room-a");
    expect(roomA).toEqual({
      roomId: "room-a",
      name: "会議室A",
      businessHoursStart: "09:00",
      businessHoursEnd: "18:00",
      capacity: 6,
    });
  });
});
