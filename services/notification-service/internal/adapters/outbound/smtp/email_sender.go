package smtp

import (
	"context"
	"crypto/tls"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"

	app "edo/services/notification-service/internal/application/service"
)

type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type EmailSender struct {
	address string
	host    string
	from    string
	auth    smtp.Auth
}

func NewEmailSender(cfg Config) (*EmailSender, error) {
	host := strings.TrimSpace(cfg.Host)
	port := strings.TrimSpace(cfg.Port)
	from := strings.TrimSpace(cfg.From)
	if host == "" || port == "" || from == "" {
		return nil, fmt.Errorf("smtp host, port and from address are required")
	}
	if _, err := mail.ParseAddress(from); err != nil {
		return nil, fmt.Errorf("invalid SMTP from address: %w", err)
	}

	username := strings.TrimSpace(cfg.Username)
	password := strings.TrimSpace(cfg.Password)
	var auth smtp.Auth
	if username != "" || password != "" {
		auth = smtp.PlainAuth("", username, password, host)
	}

	return &EmailSender{
		address: net.JoinHostPort(host, port),
		host:    host,
		from:    from,
		auth:    auth,
	}, nil
}

func (s *EmailSender) Send(_ context.Context, message app.EmailMessage) error {
	recipient := strings.TrimSpace(message.To)
	if recipient == "" {
		return fmt.Errorf("recipient email is required")
	}
	if _, err := mail.ParseAddress(recipient); err != nil {
		return fmt.Errorf("invalid recipient email: %w", err)
	}

	subject := strings.TrimSpace(message.Subject)
	if subject == "" {
		subject = "Уведомление EDO"
	}
	body := strings.TrimSpace(message.Body)
	if body == "" {
		body = "У вас новое уведомление в EDO."
	}

	msg := strings.Join([]string{
		"From: " + s.from,
		"To: " + recipient,
		"Subject: " + mimeHeader(subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		body,
	}, "\r\n")

	client, err := smtp.Dial(s.address)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}

	if s.auth != nil {
		if err := client.Auth(s.auth); err != nil {
			return err
		}
	}
	if err := client.Mail(s.from); err != nil {
		return err
	}
	if err := client.Rcpt(recipient); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write([]byte(msg)); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
}

func mimeHeader(value string) string {
	return mime.QEncoding.Encode("UTF-8", value)
}

var _ app.EmailSender = (*EmailSender)(nil)
