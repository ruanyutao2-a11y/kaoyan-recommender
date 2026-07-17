import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  handleEvaluate,
  handleGetResult,
  handleSubmitPayment,
  handleAdminOrders,
  handleAdminApprove,
  handleCheckPaymentStatus,
} from './routes'

const app = new Hono()

app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'https://ee582540.kaoyan-recommender.pages.dev',
    'https://39cefbdb.kaoyan-recommender.pages.dev',
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Admin-Password'],
}))

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.post('/api/evaluate', handleEvaluate)
app.get('/api/result/:id', handleGetResult)
app.post('/api/submit-payment', handleSubmitPayment)
app.get('/api/payment-status/:evaluationId', handleCheckPaymentStatus)
app.get('/api/admin/orders', handleAdminOrders)
app.post('/api/admin/approve', handleAdminApprove)

export default app
