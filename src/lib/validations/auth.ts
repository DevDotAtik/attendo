import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['TEACHER', 'STUDENT']),
    rollNo: z.string().optional(),
    institution: z.string().optional(),
  })
  .refine((data) => {
    if (data.role === 'STUDENT' && !data.rollNo) {
      return false;
    }
    return true;
  }, {
    message: 'Roll number is required for students',
    path: ['rollNo'],
  });

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
