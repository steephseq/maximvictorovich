FROM golang:1.25.1 as builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server .

FROM alpine:3.21.3
WORKDIR /app
RUN apk update && apk add --no-cache ffmpeg
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/server .
COPY --from=builder /app/localhost.crt .
COPY --from=builder /app/localhost.key .
COPY --from=builder /app/frontend ./frontend  
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
CMD ["./server"]
