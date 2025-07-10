import { useEffect, useState } from 'react'
import './FlipDigit.css'

function FlipDigit({ value }) {
  const [prevValue, setPrevValue] = useState(value)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (value !== prevValue) {
      setFlipping(true)
      setTimeout(() => {
        setFlipping(false)
        setPrevValue(value)
      }, 600) // match animation duration
    }
  }, [value, prevValue])

  return (
    <div className="flip-container">
      <div className="static-card">{value}</div>

      {flipping && (
        <>
          <div className="flip-card top-flip">{prevValue}</div>
          <div className="flip-card bottom-flip">{value}</div>
        </>
      )}
    </div>
  )
}

export default FlipDigit
