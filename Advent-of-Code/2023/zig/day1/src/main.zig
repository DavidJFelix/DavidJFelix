const std = @import("std");

pub fn solvePart1(input: []const u8) !u32 {
    var lines = std.mem.split(u8, input, "\n");
    var digits: [2]u8 = undefined;
    var total: u32 = 0;

    while (lines.next()) |line| {
        if (line.len == 0) {
            break;
        }
        for (line) |char| {
            if (std.ascii.isDigit(char)) {
                digits[0] = char;
                break;
            }
        }
        var index = line.len;
        while (index > 0) {
            index -= 1;
            if (std.ascii.isDigit(line[index])) {
                digits[1] = line[index];
                break;
            }
        }
        total += try std.fmt.parseInt(u32, &digits, 10);
    }
    return total;
}

pub fn main() !void {
    const part1 = try solvePart1(@embedFile("day1.txt"));

    std.debug.print("Part 1: {d}\n", .{part1});
}

test "simple test" {
    var list = std.ArrayList(i32).init(std.testing.allocator);
    defer list.deinit(); // try commenting this out and see if zig detects the memory leak!
    try list.append(42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}
