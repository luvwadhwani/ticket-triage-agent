import { z } from 'zod';
import customersJson from '@/data/customers.json';
import docsJson from '@/data/docs.json';
import invoicesJson from '@/data/invoices.json';
import statusJson from '@/data/status.json';
import ticketsJson from '@/data/tickets.json';
import { componentStatusSchema, customerSchema, helpDocSchema, invoiceSchema, ticketSchema } from './schemas';

export const customers = z.array(customerSchema).parse(customersJson);
export const invoices = z.array(invoiceSchema).parse(invoicesJson);
export const serviceStatus = z.array(componentStatusSchema).parse(statusJson);
export const helpDocs = z.array(helpDocSchema).parse(docsJson);
export const tickets = z.array(ticketSchema).parse(ticketsJson);

const norm = (email: string) => email.trim().toLowerCase();

export const getTicket = (id: string) => tickets.find((t) => t.id === id);
export const getCustomer = (email: string) => customers.find((c) => norm(c.email) === norm(email));
export const getInvoicesFor = (email: string) => invoices.filter((i) => norm(i.email) === norm(email));
