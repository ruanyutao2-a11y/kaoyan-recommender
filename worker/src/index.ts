import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  handleEvaluate,
  handleGetResult,
  handleCreateOrder,
  handleRedeem,
  handleTaobaoCallback,
} from './routes'

const app = new Hono()

app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'https://d0678593.kaoyan-recommender.pages.dev',
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.post('/api/evaluate', handleEvaluate)
app.get('/api/result/:id', handleGetResult)
app.post('/api/order', handleCreateOrder)
app.post('/api/redeem', handleRedeem)
app.post('/api/taobao-callback', handleTaobaoCallback)

export default app
