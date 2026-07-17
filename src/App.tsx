import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EvaluatingPage from './pages/EvaluatingPage'
import PreviewPage from './pages/PreviewPage'
import ResultPage from './pages/ResultPage'
import RedeemPage from './pages/RedeemPage'
import ComparePage from './pages/ComparePage'

export default function App() {
  return (
    <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/evaluating/:id" element={<EvaluatingPage />} />
        <Route path="/result/:id/preview" element={<PreviewPage />} />
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/compare/:id" element={<ComparePage />} />
        <Route path="/redeem" element={<RedeemPage />} />
    </Routes>
  )
}
