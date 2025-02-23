import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { signToken, removeToken } from "~/server/auth/jwt";

const userSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6),
});

export const authRouter = createTRPCRouter({
  signup: publicProcedure.input(userSchema).mutation(async ({ ctx, input }) => {
    // Check if username already exists
    const existingUser = await ctx.db.user.findUnique({
      where: { username: input.username },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Username already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(input.password, 10);

    // Create the user
    const user = await ctx.db.user.create({
      data: {
        username: input.username,
        password: hashedPassword,
      },
    });

    // Create JWT token
    const token = await signToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      token,
    };
  }),

  login: publicProcedure.input(userSchema).mutation(async ({ ctx, input }) => {
    // Find the user
    const user = await ctx.db.user.findUnique({
      where: { username: input.username },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invalid username or password",
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(input.password, user.password);

    if (!validPassword) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid username or password",
      });
    }

    // Create JWT token
    const token = await signToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      token,
    };
  }),

  logout: publicProcedure.mutation(async () => {
    await removeToken();
    return { success: true };
  }),
});
