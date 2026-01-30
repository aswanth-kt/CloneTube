
export const asyncHandler = (reqHandler) => {
  return (req, res, next) => {
    Promise.resolve(reqHandler(req, res, next))
    .catch((err) => next(err));
  }
};




// export const asyncHandler = async (fn) => async (req, res, next) => {
//   try {

//     await fn(req, res, next);

//   } catch (error) {
//     res.status(error.code || 500).json({
//       success: false,
//       message: error.message
//     })
//   }
// }

