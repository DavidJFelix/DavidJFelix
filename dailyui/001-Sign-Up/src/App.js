import React from 'react'
import './index.css'

const App = () => (
  <div className="root001">
    <div className='container mx-auto h-full flex justify-center items-center'>
      <div className='w-full m-2 max-w-xs sm:w-full md:w-1/2 lg:w-1/3 xl:w-1/4'>
        <h1 className='font-thin text-grey-darkest mb-6 text-center'>Create your iotv Account</h1>
        <div className='border-blue p-8 border-t-12 bg-white mb-6 rounded-lg shadow-lg'>
          <div className='mb-4'>
            <label
              className='font-bold text-grey-darker block mb-2'
            >Email</label>
            <input
              className='block appearance-none w-full bg-white border border-grey-light hover:border-grey px-2 py-2 rounded shadow'
              id='email'
              name='email'
              type='email'
            />
          </div>
          <div className='mb-4'>
            <label
              className='font-bold text-grey-darker block mb-2'
            >Username</label>
            <input
              className='block appearance-none w-full bg-white border border-grey-light hover:border-grey px-2 py-2 rounded shadow'
              id='username'
              name='username'
              type='text'
            />
          </div>
          <div className='mb-4'>
            <label
              className='font-bold text-grey-darker block mb-2'
            >Password</label>
            <input
              className='block appearance-none w-full bg-white border border-grey-light hover:border-grey px-2 py-2 rounded shadow'
              id='password'
              name='password'
              type='password'
            />
          </div>
          <button
            className='flex bg-blue-dark hover:bg-blue text-white font-bold py-2 px-4 rounded'
          >Register</button>
        </div>
        <div className='text-center'>
          <p
            className='text-grey-dark text-sm'
            >Already a user? <a
              className='no-underline text-blue font-bold'
              href='/'
              >Sign in</a>.</p>
        </div>
      </div>
    </div>
  </div>
)

export default App
