import React from 'react'
import { CardElement, Elements, StripeProvider } from 'react-stripe-elements'

import './index.css'

const App = () => (
  <StripeProvider apiKey='pk_test_YfhfHKzhltlt5vqq6shm3kZt'>
    <Elements>
      <div className="root001">
        <div className='container mx-auto h-full flex justify-center items-center'>
          <div className='w-full m-2 max-w-xs sm:w-full md:w-1/2 lg:w-1/3 xl:w-1/4'>
            <h1 className='font-thin text-grey-darkest mb-6 text-center'>Support this Creator</h1>
            <div className='border-blue p-8 border-t-12 bg-white mb-6 rounded-lg shadow-lg'>
              <div className='mb-4'>
                <label
                  className='font-bold text-grey-darker block mb-2'
                >Credit Card</label>
                <CardElement
                  className='block appearance-none w-full bg-white border border-grey-light hover:border-grey px-2 py-2 rounded shadow'
                />
              </div>
              <button
                className='flex bg-blue-dark hover:bg-blue text-white font-bold py-2 px-4 rounded'
              >Pay $25</button>
            </div>
            <div className='text-center'>
              <p
                className='text-grey-dark text-sm'
              >Secured with <a
                className='no-underline text-blue font-bold'
                href='https://stripe.com'
                rel='noopener'
                target='blank'
              >Stripe</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </Elements>
  </StripeProvider>
)

export default App
